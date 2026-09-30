import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export interface SystemAudioStatus {
  running: boolean;
  global?: boolean;
  selected?: number;
  sessions: { id: number; packageName: string }[];
  bands: { index: number; hz: number; value: number }[];
  min?: number;
  max?: number;
  eqControl?: boolean;
  bassSupported?: boolean;
  bass?: number;
  dynamicsSupported?: boolean;
  preamp?: number;
  limiter?: boolean;
  compressor?: boolean;
  visualizing?: boolean;
  waveform?: number[];
  visualizationError?: string;
  error?: string;
}
export interface MediaPlayerStatus {
  id: string; packageName: string; title: string; artist: string; playing: boolean;
  canPlay: boolean; canPause: boolean; canNext: boolean; canPrevious: boolean;
}
interface SystemAudioNative {
  mediaPlayers?(): { access: boolean; players: MediaPlayerStatus[] };
  mediaCommand?(id: string, command: 'play' | 'pause' | 'next' | 'previous'): void;
  openMediaAccess?(): void;
  status(): SystemAudioStatus;
  start(global: boolean): void;
  stop(): void;
  select(id: number): void;
  setControl(name: string, value: number): void;
  visualize(enabled: boolean): void;
}
export const externalAudio = Platform.OS === 'android'
  ? requireOptionalNativeModule<SystemAudioNative>('SystemEqualizer') : null;
