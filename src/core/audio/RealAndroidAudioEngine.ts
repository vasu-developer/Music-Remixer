import { crossfaderGain } from './crossfader';
import { ControlTrace, logControlTrace } from './controlTrace';
import { DeckId, Track, EQBand, EffectType, StereoMeter, CrossfaderCurve } from '@/types';
import {
  IAudioEngine,
  AudioEngineStats,
  EngineMeters,
  PositionUpdateListener,
  MetersUpdateListener,
} from './types';
import { LatestValueWriter } from './LatestValueWriter';
import { NativeAudio, isNativeAudioAvailable } from './nativeAudio';
import { NativeAudioEngine } from './NativeAudioEngine';

interface DeckAudioInternalState {
  track: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  tempo: number;
  pitchBend: number;
  volume: number;
  gain: number;
  eq: { low: number; mid: number; high: number; lowKill: boolean; midKill: boolean; highKill: boolean };
  backend: 'none' | 'simulation' | 'media' | 'cpp';
}

export class RealAndroidAudioEngine implements IAudioEngine {
  private static instance: RealAndroidAudioEngine | null = null;

  private isInitialized = false;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private lastTickTime = 0;

  private unsubs: Array<() => void> = [];

  private decks: Record<DeckId, DeckAudioInternalState> = {
    A: {
      track: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      tempo: 1.0,
      pitchBend: 0,
      volume: 0.85,
      gain: 0.5,
      eq: { low: 0, mid: 0, high: 0, lowKill: false, midKill: false, highKill: false },
      backend: 'none',
    },
    B: {
      track: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      tempo: 1.0,
      pitchBend: 0,
      volume: 0.85,
      gain: 0.5,
      eq: { low: 0, mid: 0, high: 0, lowKill: false, midKill: false, highKill: false },
      backend: 'none',
    },
  };

  private seekRevision: Record<DeckId, number> = { A: 0, B: 0 };
  private awaitingSeek: Record<DeckId, boolean> = { A: false, B: false };

  private mixerWriter = new LatestValueWriter<[number, number]>(
    ([a, b]) => NativeAudio.setMixerVolumes(a, b),
    (a, b) => a[0] === b[0] && a[1] === b[1],
    (error) => console.warn('[Audio controls] mixer write failed', error));
  private createRateWriter(id: DeckId) {
    return new LatestValueWriter<[number, number]>(
      ([tempo, bend]) => NativeAudio.setDeckRate(id, tempo, bend),
      (a, b) => a[0] === b[0] && a[1] === b[1],
      (error) => console.warn(`[Audio controls] rate ${id} failed`, error));
  }
  private createSeekWriter(id: DeckId) {
    return new LatestValueWriter<{ position: number; revision: number }>(
      async (value) => {
        if (this.decks[id].backend === 'cpp') {
          const actual = await NativeAudioEngine.seek(id, value.position);
          if (value.revision === this.seekRevision[id]) {
            this.awaitingSeek[id] = false;
            this.decks[id].position = actual;
            this.notifyPosition(id, actual);
          }
        } else if (this.decks[id].backend === 'media') {
          await NativeAudio.seek(id, value.position, value.revision);
        }
      },
      (a, b) => a.revision === b.revision,
      (error) => { this.awaitingSeek[id] = false; console.warn(`[Audio controls] seek ${id} failed`, error); });
  }
  private rateWriters = { A: this.createRateWriter('A'), B: this.createRateWriter('B') };
  private seekWriters = { A: this.createSeekWriter('A'), B: this.createSeekWriter('B') };

  flushControls(): void {
    this.mixerWriter.flush();
    for (const id of ['A', 'B'] as const) {
      this.rateWriters[id].flush();
      this.seekWriters[id].flush();
    }
  }

  /** Diagnostics measure command traffic, not acoustic/output latency. */
  getControlDiagnostics() {
    return { mixer: { ...this.mixerWriter.stats },
      rateA: { ...this.rateWriters.A.stats }, rateB: { ...this.rateWriters.B.stats },
      seekA: { ...this.seekWriters.A.stats }, seekB: { ...this.seekWriters.B.stats } };
  }

  private crossfader = 0.0;
  private crossfaderCurve: CrossfaderCurve = 'smooth';
  private masterVolume = 0.85;

  private positionListeners: Set<PositionUpdateListener> = new Set();
  private playbackListeners = new Set<(deckId: DeckId, playing: boolean) => void>();
  private publishedPlaying: Record<DeckId, boolean> = { A: false, B: false };
  private metersListeners: Set<MetersUpdateListener> = new Set();

  public static getInstance(): RealAndroidAudioEngine {
    if (!RealAndroidAudioEngine.instance) {
      RealAndroidAudioEngine.instance = new RealAndroidAudioEngine();
    }
    return RealAndroidAudioEngine.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.lastTickTime = Date.now();

    if (isNativeAudioAvailable()) {
      const unsubPos = NativeAudio.addPositionListener((event) => {
        const id = (event.deckId.toUpperCase() === 'B' ? 'B' : 'A') as DeckId;
        if (this.decks[id].backend !== 'media') return;
        const deck = this.decks[id];
        // Reject old clocks while a newer scrub target is still pending.
        if ((event.seekRevision ?? 0) < this.seekRevision[id] || event.isSeeking) return;
        this.awaitingSeek[id] = false;
        deck.position = event.position;
        this.notifyPosition(id, event.position);
      });
      this.unsubs.push(unsubPos);

      const unsubState = NativeAudio.addPlaybackStateListener((event) => {
        const id = (event.deckId.toUpperCase() === 'B' ? 'B' : 'A') as DeckId;
        if (this.decks[id].backend !== 'media') return;
        const deck = this.decks[id];
        deck.isPlaying = event.isPlaying;
        if (event.isEnded) {
          deck.isPlaying = false;
          deck.position = deck.duration;
          this.notifyPosition(id, deck.position);
        }
      });
      this.unsubs.push(unsubState);

      const unsubComp = NativeAudio.addTrackCompletedListener((event) => {
        const id = (event.deckId.toUpperCase() === 'B' ? 'B' : 'A') as DeckId;
        if (this.decks[id].backend !== 'media') return;
        const deck = this.decks[id];
        deck.isPlaying = false;
        deck.position = deck.duration;
        this.notifyPosition(id, deck.position);
      });
      this.unsubs.push(unsubComp);
    }

    this.timerId = setInterval(() => {
      this.tick();
    }, 50);
  }

  async dispose(): Promise<void> {
    this.flushControls();
    await Promise.all([this.mixerWriter.whenIdle(), ...Object.values(this.rateWriters).map(w => w.whenIdle()),
      ...Object.values(this.seekWriters).map(w => w.whenIdle())]);
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    for (const unsub of this.unsubs) {
      try {
        unsub();
      } catch {}
    }
    this.unsubs = [];

    if (isNativeAudioAvailable()) {
      try {
        await Promise.all([NativeAudio.stop('A'), NativeAudio.stop('B')]);
      } catch {}
    }

    if (NativeAudioEngine.isAvailable()) {
      await NativeAudioEngine.stop();
      await NativeAudioEngine.release();
    }
    for (const id of ['A', 'B'] as const) {
      this.decks[id].isPlaying = false;
      this.publishPlayback(id);
      this.decks[id].backend = 'none';
    }
    this.playbackListeners.clear();
    this.positionListeners.clear();
    this.metersListeners.clear();
    this.isInitialized = false;
  }

  async loadTrack(deckId: DeckId, track: Track): Promise<boolean> {
    const deck = this.decks[deckId];
    this.seekWriters[deckId].clearPending();
    this.rateWriters[deckId].clearPending();
    await Promise.all([this.seekWriters[deckId].whenIdle(), this.rateWriters[deckId].whenIdle()]);
    // Stop the previous owner before switching backends or replacing its track.
    await this.pause(deckId);
    deck.backend = 'none';
    deck.track = null;
    deck.position = 0;
    deck.duration = 0;
    deck.tempo = 1;
    deck.pitchBend = 0;
    this.seekRevision[deckId] = 0;
    this.awaitingSeek[deckId] = false;
    if (!track.uri) {
      deck.backend = 'simulation'; // Existing demo tracks only.
    } else {
      if (NativeAudioEngine.isAvailable()) {
        try {
          if (!await NativeAudioEngine.initialize()) throw new Error('Oboe initialization failed');
          const result = await NativeAudioEngine.loadTrack(deckId, track.uri);
          if (!result.success) throw new Error('Native decoder rejected track');
          deck.backend = 'cpp';
          deck.duration = result.duration;
          NativeAudioEngine.setVolume(deckId, this.calculateEffectiveVolume(deckId));
          NativeAudioEngine.setRate(deckId, 1);
          for (const band of ['low', 'mid', 'high'] as const) NativeAudioEngine.setEQ(deckId, band, deck.eq[band], deck.eq[`${band}Kill`]);
        } catch (error) {
          console.warn(`[Audio] C++ load failed for Deck ${deckId}`, error);
        }
      }
      if (deck.backend === 'none' && isNativeAudioAvailable()) {
        try {
          const result = await NativeAudio.loadTrack(deckId, track.uri);
          deck.backend = 'media';
          deck.duration = result.duration;
          await this.syncDeckAudioParams(deckId);
        } catch (error) {
          deck.backend = 'none';
          console.warn(`[Audio] MediaPlayer load failed for Deck ${deckId}`, error);
        }
      }
      if (deck.backend === 'none') {
        this.notifyPosition(deckId, 0);
        return false;
      }
    }
    deck.track = track;
    if (deck.duration <= 0) deck.duration = track.duration;
    this.notifyPosition(deckId, 0);
    return true;
  }

  async play(deckId: DeckId, trace?: ControlTrace): Promise<void> {
    logControlTrace(trace, 'ENGINE_PLAY', `deck=${deckId}`);
    const deck = this.decks[deckId];
    if (!deck.track || deck.backend === 'none') throw new Error('No playable track loaded');
    let started = true;
    if (deck.backend === 'cpp') {
      NativeAudioEngine.setVolume(deckId, this.calculateEffectiveVolume(deckId));
      started = await NativeAudioEngine.play(deckId, trace);
    } else if (deck.backend === 'media') {
      await this.syncDeckAudioParams(deckId);
      started = await NativeAudio.play(deckId);
    }
    if (!started) throw new Error(`Deck ${deckId} could not start`);
    deck.isPlaying = true;
    this.publishPlayback(deckId);
  }

  async pause(deckId: DeckId, trace?: ControlTrace): Promise<void> {
    logControlTrace(trace, 'ENGINE_PAUSE', `deck=${deckId}`);
    const deck = this.decks[deckId];
    let paused = true;
    if (deck.backend === 'cpp') paused = await NativeAudioEngine.pause(deckId, trace);
    else if (deck.backend === 'media') paused = await NativeAudio.pause(deckId);
    if (!paused) throw new Error(`Deck ${deckId} could not pause`);
    deck.isPlaying = false;
    this.publishPlayback(deckId);
  }

  async seek(deckId: DeckId, positionSeconds: number): Promise<void> {
    const deck = this.decks[deckId];
    const position = Math.max(0, Math.min(positionSeconds, deck.duration));
    deck.position = position;
    if (deck.backend === 'cpp' || deck.backend === 'media') {
      this.awaitingSeek[deckId] = true;
      this.seekWriters[deckId].submit({ position, revision: ++this.seekRevision[deckId] });
    }
    this.notifyPosition(deckId, position);
  }

  async setTempo(deckId: DeckId, rate: number): Promise<void> {
    this.decks[deckId].tempo = Math.max(0.5, Math.min(2.0, rate));
    this.queueRate(deckId);
  }

  async setPitchBend(deckId: DeckId, amount: number): Promise<void> {
    this.decks[deckId].pitchBend = Math.max(-1, Math.min(1, amount));
    this.queueRate(deckId);
  }

  async setVolume(deckId: DeckId, volume: number, seq?: number, tGesture?: number): Promise<void> {
    if (seq && seq > 0) {
      console.log(`[VOL_TRACE] seq=${seq} ENGINE_SET_VOLUME deck=${deckId} vol=${volume.toFixed(2)} deltaFromGesture=${Date.now() - (tGesture ?? 0)}ms`);
    }
    this.decks[deckId].volume = Math.max(0, Math.min(1, volume));
    if (this.decks[deckId].backend === 'cpp') this.applyNativeDirectVolume(deckId, seq, tGesture);
    else this.queueMixer();
  }

  async setGain(deckId: DeckId, gain: number): Promise<void> {
    this.decks[deckId].gain = Math.max(0, Math.min(1, gain));
    this.applyNativeDirectVolume(deckId);
    this.queueMixer();
  }

  async setMasterVolume(volume: number): Promise<void> {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.applyNativeDirectVolume('A');
    this.applyNativeDirectVolume('B');
    this.queueMixer();
  }

  async setCrossfader(position: number): Promise<void> {
    this.crossfader = Math.max(-1, Math.min(1, position));
    this.applyNativeDirectVolume('A');
    this.applyNativeDirectVolume('B');
    this.queueMixer();
  }

  async setCrossfaderCurve(curve: CrossfaderCurve): Promise<void> {
    this.crossfaderCurve = curve;
    await this.setCrossfader(this.crossfader);
  }

  async setEQ(deckId: DeckId, band: EQBand, value: number, isKill = false): Promise<void> {
    const deck = this.decks[deckId];
    value = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    if (band === 'low') {
      deck.eq.low = value;
      deck.eq.lowKill = isKill;
    } else if (band === 'mid') {
      deck.eq.mid = value;
      deck.eq.midKill = isKill;
    } else if (band === 'high') {
      deck.eq.high = value;
      deck.eq.highKill = isKill;
    }
    if (deck.backend === 'cpp') NativeAudioEngine.setEQ(deckId, band, value, isKill);
    else if (deck.backend === 'media') throw new Error('EQ is unavailable on the MediaPlayer fallback backend.');
  }

  async setEffect(
    _target: DeckId | 'master',
    _effectType: EffectType,
    _params: Record<string, unknown>,
    _enabled: boolean
  ): Promise<void> {}

  async scratch(deckId: DeckId, deltaVelocity: number): Promise<void> {
    const deck = this.decks[deckId];
    if (!deck.track) return;
    const newPos = Math.max(0, Math.min(deck.duration, deck.position + deltaVelocity * 0.05));
    void this.seek(deckId, newPos);
  }

  async getPosition(deckId: DeckId): Promise<number> {
    if (this.decks[deckId].backend === 'cpp') {
      const pos = NativeAudioEngine.getPosition(deckId);
      if (!this.awaitingSeek[deckId]) this.decks[deckId].position = pos;
    }
    return this.decks[deckId].position;
  }

  async getDuration(deckId: DeckId): Promise<number> {
    if (this.decks[deckId].backend === 'cpp') {
      const dur = NativeAudioEngine.getDuration(deckId);
      if (dur > 0) this.decks[deckId].duration = dur;
    }
    return this.decks[deckId].duration;
  }

  getEngineStats(): AudioEngineStats {
    return {
      sampleRate: 48000,
      bufferSizeFrames: 256,
      latencyMs: 5.3,
      cpuLoadPercent: 6.8,
      underrunCount: 0,
    };
  }

  addPositionListener(listener: PositionUpdateListener): () => void {
    this.positionListeners.add(listener);
    return () => {
      this.positionListeners.delete(listener);
    };
  }

  addMetersListener(listener: MetersUpdateListener): () => void {
    this.metersListeners.add(listener);
    return () => {
      this.metersListeners.delete(listener);
    };
  }

  private applyNativeDirectVolume(deckId: DeckId, seq?: number, tGesture?: number): void {
    if (this.decks[deckId].backend === 'cpp') {
      NativeAudioEngine.setVolume(deckId, this.calculateEffectiveVolume(deckId), seq, tGesture);
    }
  }

  private calculateEffectiveVolume(deckId: DeckId): number {
    const deck = this.decks[deckId];
    const gainFactor = deck.gain * 2.0;
    const channelVol = deck.volume * gainFactor;

    const xfGain = crossfaderGain(this.crossfader, deckId, this.crossfaderCurve);

    const effective = channelVol * xfGain * this.masterVolume;
    return Math.max(0, Math.min(1.0, effective));
  }

  private queueMixer(): void {
    if (!isNativeAudioAvailable()) return;
    // When C++/Oboe is active, mute MediaPlayer completely to prevent double playback or unwanted audio
    const volA = this.decks.A.backend === 'media' ? this.calculateEffectiveVolume('A') : 0;
    const volB = this.decks.B.backend === 'media' ? this.calculateEffectiveVolume('B') : 0;
    this.mixerWriter.submit([volA, volB]);
  }

  private queueRate(deckId: DeckId): void {
    const deck = this.decks[deckId];
    if (deck.backend === 'cpp') NativeAudioEngine.setRate(deckId, deck.tempo * (1 + deck.pitchBend * 0.08));
    else if (deck.backend === 'media' && isNativeAudioAvailable()) this.rateWriters[deckId].submit([deck.tempo, deck.pitchBend]);
  }

  private async syncDeckAudioParams(deckId: DeckId): Promise<void> {
    const deck = this.decks[deckId];
    if (deck.backend !== 'media' || !isNativeAudioAvailable()) return;
    this.queueMixer();
    this.queueRate(deckId);
    this.flushControls();
    // Only discrete transport preparation waits; gestures never await this path.
    await Promise.all([this.mixerWriter.whenIdle(), this.rateWriters[deckId].whenIdle(), this.seekWriters[deckId].whenIdle()]);
  }

  private tick(): void {
    const now = Date.now();
    const dtSeconds = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    for (const deckId of ['A', 'B'] as DeckId[]) {
      const deck = this.decks[deckId];
      if (deck.backend === 'cpp') {
        deck.isPlaying = NativeAudioEngine.isPlaying(deckId);
        if (!this.awaitingSeek[deckId]) {
          deck.position = NativeAudioEngine.getPosition(deckId);
          this.notifyPosition(deckId, deck.position);
        }
      } else if (deck.isPlaying && deck.track && deck.backend === 'simulation') {
        const effectiveRate = deck.tempo * (1 + deck.pitchBend * 0.08);
        deck.position += dtSeconds * effectiveRate;
        if (deck.position >= deck.duration) {
          deck.position = deck.duration;
          deck.isPlaying = false;
        }
        this.notifyPosition(deckId, deck.position);
      }
    }

    for (const id of ['A', 'B'] as const) this.publishPlayback(id);
    this.calculateMeters();
  }

  addPlaybackStateListener(listener: (deckId: DeckId, playing: boolean) => void): () => void {
    this.playbackListeners.add(listener);
    return () => { this.playbackListeners.delete(listener); };
  }

  private publishPlayback(deckId: DeckId): void {
    const playing = this.decks[deckId].isPlaying;
    if (this.publishedPlaying[deckId] === playing) return;
    this.publishedPlaying[deckId] = playing;
    for (const listener of this.playbackListeners) listener(deckId, playing);
  }

  private lastNotifiedPosition: Record<DeckId, number> = { A: -1, B: -1 };
  private notifyPosition(deckId: DeckId, position: number): void {
    if (Math.abs(position - this.lastNotifiedPosition[deckId]) < 0.05 && this.decks[deckId].isPlaying) {
      return;
    }
    this.lastNotifiedPosition[deckId] = position;
    for (const listener of this.positionListeners) {
      listener(deckId, position);
    }
  }

  private calculateMeters(): void {
    if (this.metersListeners.size === 0) return;

    const deckA = this.decks.A;
    const deckB = this.decks.B;

    const computeDeckLevel = (deck: DeckAudioInternalState, deckId: DeckId): StereoMeter => {
      if (!deck.isPlaying || !deck.track) return { left: 0, right: 0 };
      const noise = 0.75 + Math.sin(Date.now() / 120) * 0.15 + (Math.random() * 0.1 - 0.05);
      const lowVal = deck.eq.lowKill ? -1.0 : deck.eq.low;
      const midVal = deck.eq.midKill ? -1.0 : deck.eq.mid;
      const highVal = deck.eq.highKill ? -1.0 : deck.eq.high;
      const eqMultiplier = (1 + lowVal * 0.2) * (1 + midVal * 0.2) * (1 + highVal * 0.2);
      const effectiveVol = this.calculateEffectiveVolume(deckId);
      const level = Math.min(1.0, Math.max(0, noise * effectiveVol * eqMultiplier));
      return {
        left: level,
        right: Math.min(1.0, Math.max(0, level * (0.95 + Math.random() * 0.1))),
      };
    };

    const vuA = computeDeckLevel(deckA, 'A');
    const vuB = computeDeckLevel(deckB, 'B');

    // Deck estimates already include crossfader and master gain. Do not apply twice.
    const masterLeft = Math.min(1.0, vuA.left + vuB.left);
    const masterRight = Math.min(1.0, vuA.right + vuB.right);

    const meters: EngineMeters = {
      deckA: vuA,
      deckB: vuB,
      master: { left: masterLeft, right: masterRight },
    };

    for (const listener of this.metersListeners) {
      listener(meters);
    }
  }
}
