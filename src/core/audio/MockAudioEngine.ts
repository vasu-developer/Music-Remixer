import { crossfaderGain } from './crossfader';
import { CrossfaderCurve } from '@/types';
import { DeckId, Track, EQBand, EffectType, StereoMeter } from '@/types';
import {
  IAudioEngine,
  AudioEngineStats,
  EngineMeters,
  PositionUpdateListener,
  MetersUpdateListener,
} from './types';

interface DeckInternalState {
  track: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  tempo: number;
  pitchBend: number;
  volume: number;
  gain: number;
  eq: { low: number; mid: number; high: number; lowKill: boolean; midKill: boolean; highKill: boolean };
}

/**
 * MockAudioEngine
 *
 * Conforming implementation of IAudioEngine used during UI development
 * before native C++/Oboe DSP integration. Provides accurate playback timing,
 * position updates, and realistic signal level metering.
 */
export class MockAudioEngine implements IAudioEngine {
  private static instance: MockAudioEngine | null = null;

  private isInitialized = false;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private lastTickTime = 0;

  private decks: Record<DeckId, DeckInternalState> = {
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
    },
  };

  private crossfaderCurve: CrossfaderCurve = 'smooth';
  private crossfader = 0.0; // -1 to 1
  private masterVolume = 0.85;

  private positionListeners: Set<PositionUpdateListener> = new Set();
  private metersListeners: Set<MetersUpdateListener> = new Set();

  public static getInstance(): MockAudioEngine {
    if (!MockAudioEngine.instance) {
      MockAudioEngine.instance = new MockAudioEngine();
    }
    return MockAudioEngine.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.lastTickTime = Date.now();

    // 50ms engine tick (~20 Hz updates for responsive UI meters & playhead)
    this.timerId = setInterval(() => {
      this.tick();
    }, 50);
  }

  async dispose(): Promise<void> {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.positionListeners.clear();
    this.metersListeners.clear();
    this.isInitialized = false;
  }

  async loadTrack(deckId: DeckId, track: Track): Promise<boolean> {
    const deck = this.decks[deckId];
    deck.track = track;
    deck.position = 0;
    deck.duration = track.duration;
    deck.isPlaying = false;
    this.notifyPosition(deckId, 0);
    return true;
  }

  async play(deckId: DeckId): Promise<void> {
    const deck = this.decks[deckId];
    if (deck.track) {
      deck.isPlaying = true;
    }
  }

  async pause(deckId: DeckId): Promise<void> {
    const deck = this.decks[deckId];
    deck.isPlaying = false;
  }

  async seek(deckId: DeckId, positionSeconds: number): Promise<void> {
    const deck = this.decks[deckId];
    deck.position = Math.max(0, Math.min(positionSeconds, deck.duration));
    this.notifyPosition(deckId, deck.position);
  }

  async setTempo(deckId: DeckId, rate: number): Promise<void> {
    this.decks[deckId].tempo = Math.max(0.5, Math.min(2.0, rate));
  }

  async setPitchBend(deckId: DeckId, amount: number): Promise<void> {
    this.decks[deckId].pitchBend = Math.max(-1.0, Math.min(1.0, amount));
  }

  async setVolume(deckId: DeckId, volume: number): Promise<void> {
    this.decks[deckId].volume = Math.max(0, Math.min(1.0, volume));
  }

  async setGain(deckId: DeckId, gain: number): Promise<void> {
    this.decks[deckId].gain = Math.max(0, Math.min(1.0, gain));
  }

  async setMasterVolume(volume: number): Promise<void> {
    this.masterVolume = Math.max(0, Math.min(1.0, volume));
  }

  async setCrossfaderCurve(curve: CrossfaderCurve): Promise<void> { this.crossfaderCurve = curve; }

  async setCrossfader(position: number): Promise<void> {
    this.crossfader = Math.max(-1.0, Math.min(1.0, position));
  }

  async setEQ(deckId: DeckId, band: EQBand, value: number, isKill = false): Promise<void> {
    const deck = this.decks[deckId];
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
  }

  async setEffect(
    _target: DeckId | 'master',
    _effectType: EffectType,
    _params: Record<string, unknown>,
    _enabled: boolean
  ): Promise<void> {
    // Contract point for native DSP effect unit
  }

  async scratch(deckId: DeckId, deltaVelocity: number): Promise<void> {
    const deck = this.decks[deckId];
    if (!deck.track) return;
    // Scrub position proportional to velocity
    deck.position = Math.max(0, Math.min(deck.duration, deck.position + deltaVelocity * 0.05));
    this.notifyPosition(deckId, deck.position);
  }

  async getPosition(deckId: DeckId): Promise<number> {
    return this.decks[deckId].position;
  }

  async getDuration(deckId: DeckId): Promise<number> {
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

  private tick(): void {
    const now = Date.now();
    const dtSeconds = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    // Advance playing decks
    for (const deckId of ['A', 'B'] as DeckId[]) {
      const deck = this.decks[deckId];
      if (deck.isPlaying && deck.track) {
        const effectiveRate = deck.tempo * (1 + deck.pitchBend * 0.08);
        deck.position += dtSeconds * effectiveRate;
        if (deck.position >= deck.duration) {
          deck.position = deck.duration;
          deck.isPlaying = false;
        }
        this.notifyPosition(deckId, deck.position);
      }
    }

    // Generate signal metering
    this.calculateMeters();
  }

  private notifyPosition(deckId: DeckId, position: number): void {
    for (const listener of this.positionListeners) {
      listener(deckId, position);
    }
  }

  private calculateMeters(): void {
    if (this.metersListeners.size === 0) return;

    // Compute deck A level
    const deckA = this.decks.A;
    const deckB = this.decks.B;

    const computeDeckLevel = (deck: DeckInternalState): StereoMeter => {
      if (!deck.isPlaying || !deck.track) return { left: 0, right: 0 };
      // Base dynamic fluctuation
      const noise = 0.75 + Math.sin(Date.now() / 120) * 0.15 + (Math.random() * 0.1 - 0.05);
      const eqMultiplier = (1 + deck.eq.low * 0.2) * (1 + deck.eq.mid * 0.2) * (1 + deck.eq.high * 0.2);
      const level = Math.min(1.0, Math.max(0, noise * deck.volume * (deck.gain * 1.5) * eqMultiplier));
      return {
        left: level,
        right: Math.min(1.0, Math.max(0, level * (0.95 + Math.random() * 0.1))),
      };
    };

    const vuA = computeDeckLevel(deckA);
    const vuB = computeDeckLevel(deckB);

    // Crossfader curves:
    const xFadeGainA = crossfaderGain(this.crossfader, 'A', this.crossfaderCurve);
    const xFadeGainB = crossfaderGain(this.crossfader, 'B', this.crossfaderCurve);

    const masterLeft = Math.min(1.0, (vuA.left * xFadeGainA + vuB.left * xFadeGainB) * this.masterVolume);
    const masterRight = Math.min(1.0, (vuA.right * xFadeGainA + vuB.right * xFadeGainB) * this.masterVolume);

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
