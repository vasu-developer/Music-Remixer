import { ControlTrace } from './controlTrace';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { DeckId, EQBand } from '@/types';

export interface NativeDeckDiagnostics {
  loaded: boolean;
  playing: boolean;
  durationUs: number;
  trackSampleRate: number;
  trackChannels: number;
  decodedFrames: number;
  playedFrames: number;
  bufferedFrames: number;
  minBufferedFrames: number;
  maxBufferedFrames: number;
  averageBufferedFrames: number;
  audioUnderrunCount: number;
  underrunFrames: number;
  decoderStalls: number;
  decoderLoopIterations: number;
  pcmEncoding: string;
  isEof: boolean;
  volume: number;
  lastVolumeLatencyUs: number;
}

export interface NativeEngineDiagnostics {
  audioBackend: string;
  initialized: boolean;
  running: boolean;
  oboeRunning?: boolean;
  sampleRate: number;
  channelCount: number;
  framesPerBurst: number;
  bufferSize: number;
  performanceMode: string;
  sharingMode: string;
  format: string;
  audioApi: string;
  lastError: string;
  callbackCount: number;
  underrunCount: number;
  streamLatencyMs?: number;
  openAttempt: number;
  deckARate?: number;
  deckBRate?: number;
  deckAEqLowDb?: number;
  deckAEqMidDb?: number;
  deckAEqHighDb?: number;
  deckBEqLowDb?: number;
  deckBEqMidDb?: number;
  deckBEqHighDb?: number;
  deckALoaded?: boolean;
  deckAPlaying?: boolean;
  deckBLoaded?: boolean;
  deckBPlaying?: boolean;
  trackLoaded?: boolean;
  trackSampleRate?: number;
  trackChannels?: number;
  durationUs?: number;
  decodedFrames?: number;
  playedFrames?: number;
  bufferedFrames?: number;
  minBufferedFrames?: number;
  maxBufferedFrames?: number;
  averageBufferedFrames?: number;
  audioUnderrunCount?: number;
  underrunFrames?: number;
  decoderStalls?: number;
  decoderLoopIterations?: number;
  codecInputCount?: number;
  codecOutputCount?: number;
  resamplerOutputFrames?: number;
  ringBufferWriteFailures?: number;
  ringBufferReadUnderruns?: number;
  pcmEncoding?: string;
  isEof?: boolean;
  volume?: number;
  lastVolumeLatencyUs?: number;
  toneFrequencyHz: number;
  deviceModel: string;
  androidVersion: string;
  controlThread: string;
}

interface NativeEngineModule {
  setMasterFx?(index: number, value: number): void;
  initialize(): Promise<boolean>;
  loadTrack(deckId: string, uri: string): Promise<{ success: boolean; duration: number }>;
  play(deckId: string): Promise<boolean>;
  pause(deckId: string): Promise<boolean>;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  seek(deckId: string, positionSeconds: number): Promise<number>;
  release(): Promise<void>;
  setTestToneVolume(volume: number): void;
  setVolume(deckId: string, volume: number, seq?: number, tGesture?: number): void;
  setEQ(deckId: string, band: number, value: number, kill: boolean): void;
  setRate(deckId: string, rate: number): void;
  getPosition(deckId: string): number;
  getDuration(deckId: string): number;
  isPlaying(deckId: string): boolean;
  getDiagnostics(): Promise<NativeEngineDiagnostics>;
}

const native = Platform.OS === 'android'
  ? requireOptionalNativeModule<NativeEngineModule>('NativeAudioEngine') : null;

function requireEngine(): NativeEngineModule {
  if (!native) throw new Error('NativeAudioEngine unavailable: install the Android development build.');
  return native;
}

/** Phase 3.3.2 Dual-Deck Native PCM Audio Decoding & Playback through Oboe. */
export const NativeAudioEngine = {
  supportsMasterFx: () => typeof native?.setMasterFx === 'function',
  setMasterFx: (index: number, value: number) => {
    const engine = requireEngine();
    if (!engine.setMasterFx) throw new Error('Install the updated APK to enable master sound controls.');
    engine.setMasterFx(index, value);
  },
  isAvailable: () => native !== null && typeof (native as Partial<NativeEngineModule>).getDiagnostics === 'function',
  initialize: () => requireEngine().initialize(),
  loadTrack: (deckId: DeckId, uri: string) => requireEngine().loadTrack(deckId, uri),
  play: async (deckId: DeckId, _trace?: ControlTrace) => requireEngine().play(deckId),
  pause: async (deckId: DeckId, _trace?: ControlTrace) => requireEngine().pause(deckId),
  start: () => requireEngine().start(),
  stop: () => requireEngine().stop(),
  seek: (deckId: DeckId, positionSeconds: number) => requireEngine().seek(deckId, positionSeconds),
  release: () => requireEngine().release(),
  setTestToneVolume: (volume: number) => requireEngine().setTestToneVolume(volume),
  setVolume: (deckId: DeckId, volume: number, seq?: number, tGesture?: number) => {
    requireEngine().setVolume(deckId, volume, seq, tGesture);
  },
  setEQ: (deckId: DeckId, band: EQBand, value: number, kill: boolean) => {
    const engine = requireEngine();
    if (typeof engine.setEQ !== 'function') throw new Error('EQ requires the updated Android APK.');
    engine.setEQ(deckId, { low: 0, mid: 1, high: 2 }[band], value, kill);
  },
  setRate: (deckId: DeckId, rate: number) => {
    const engine = requireEngine();
    if (typeof engine.setRate !== 'function') throw new Error('Pitch/tempo requires the updated Android APK.');
    engine.setRate(deckId, rate);
  },
  getPosition: (deckId: DeckId) => (native ? native.getPosition(deckId) : 0),
  getDuration: (deckId: DeckId) => (native ? native.getDuration(deckId) : 0),
  isPlaying: (deckId: DeckId) => (native ? native.isPlaying(deckId) : false),
  getDiagnostics: () => requireEngine().getDiagnostics(),
};
