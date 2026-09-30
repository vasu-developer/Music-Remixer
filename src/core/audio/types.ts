import { ControlTrace } from './controlTrace';
import { DeckId, Track, EQBand, EffectType, StereoMeter, CrossfaderCurve } from '@/types';

export interface AudioEngineStats {
  sampleRate: number;
  bufferSizeFrames: number;
  latencyMs: number;
  cpuLoadPercent: number;
  underrunCount: number;
}

export interface EngineMeters {
  deckA: StereoMeter;
  deckB: StereoMeter;
  master: StereoMeter;
}

export type PositionUpdateListener = (deckId: DeckId, positionSeconds: number) => void;
export type MetersUpdateListener = (meters: EngineMeters) => void;

/**
 * AudioEngine Interface
 *
 * All UI and business logic code interacts EXCLUSIVELY with this interface.
 * When the C++/Oboe native DSP engine is integrated later, it will implement
 * this exact contract without requiring any UI refactoring.
 */
export interface IAudioEngine {
  setMasterFx?: (index: number, value: number) => void;
  masterFxIssue?: () => string | null;
  /** Initialize the engine, allocating audio tracks / buffers */
  initialize(): Promise<void>;

  /** Teardown and release audio resources */
  dispose(): Promise<void>;

  /** Load a track onto a deck */
  loadTrack(deckId: DeckId, track: Track): Promise<boolean>;

  /** Start playback on a deck */
  play(deckId: DeckId, trace?: ControlTrace): Promise<void>;

  /** Pause playback on a deck */
  pause(deckId: DeckId, trace?: ControlTrace): Promise<void>;

  /** Seek playback position on a deck (in seconds) */
  seek(deckId: DeckId, positionSeconds: number): Promise<void>;

  /** Set playback rate / tempo scale (e.g. 1.0 = normal, 0.95 = -5%) */
  setTempo(deckId: DeckId, rate: number): Promise<void>;

  /** Temporary pitch nudge for beat matching (-1.0 to 1.0) */
  setPitchBend(deckId: DeckId, amount: number): Promise<void>;

  /** Set channel volume fader (0.0 to 1.0) */
  setVolume(deckId: DeckId, volume: number, seq?: number, tGesture?: number): Promise<void>;

  /** Set channel gain / trim (0.0 to 1.0) */
  setGain(deckId: DeckId, gain: number): Promise<void>;

  /** Set master output volume (0.0 to 1.0) */
  setMasterVolume(volume: number): Promise<void>;

  /** Set crossfader position (-1.0 = Deck A, 0.0 = center, 1.0 = Deck B) */
  setCrossfader(position: number): Promise<void>;
  setCrossfaderCurve?(curve: CrossfaderCurve): Promise<void>;

  /** Set 3-band EQ value (-1.0 to +1.0) and optional band kill */
  setEQ(deckId: DeckId, band: EQBand, value: number, isKill?: boolean): Promise<void>;

  /** Set effect parameters and active state */
  setEffect(
    target: DeckId | 'master',
    effectType: EffectType,
    params: Record<string, unknown>,
    enabled: boolean
  ): Promise<void>;

  /** Scratch / jog wheel nudge velocity simulation */
  scratch(deckId: DeckId, deltaVelocity: number): Promise<void>;

  /** Get the current playback position of a deck (in seconds) */
  getPosition(deckId: DeckId): Promise<number>;

  /** Get the track duration of a deck (in seconds) */
  getDuration(deckId: DeckId): Promise<number>;

  /** Flush latest pending continuous controls without waiting on native work. */
  flushControls?(): void;

  /** Query current audio engine statistics */
  getEngineStats(): AudioEngineStats;

  /** Subscribe to high-resolution position updates */
  addPositionListener(listener: PositionUpdateListener): () => void;

  /** Native transport changes, including EOF and background pause. */
  addPlaybackStateListener?(listener: (deckId: DeckId, playing: boolean) => void): () => void;

  /** Subscribe to real-time VU meter level updates */
  addMetersListener(listener: MetersUpdateListener): () => void;
}
