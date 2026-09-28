import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export interface NativePlaybackState {
  deckId: string;
  isPlaying: boolean;
  position: number;
  duration: number;
}

export interface NativeLoadResult {
  deckId: string;
  duration: number;
}

export interface NativePositionEvent {
  deckId: string;
  position: number;
  seekRevision?: number;
  isSeeking?: boolean;
}

export interface NativePlaybackStateChangeEvent {
  deckId: string;
  isPlaying: boolean;
  isEnded: boolean;
}

export interface NativeTrackCompletedEvent {
  deckId: string;
}

export interface NativeErrorEvent {
  deckId: string;
  code: string;
  message: string;
}

interface AudioPlaybackNativeModule {
  loadTrack(deckId: string, uri: string): Promise<NativeLoadResult>;
  play(deckId: string): Promise<boolean>;
  pause(deckId: string): Promise<boolean>;
  seek(deckId: string, positionSeconds: number, revision: number): Promise<number>;
  setMixerVolumes(volumeA: number, volumeB: number): Promise<void>;
  setDeckRate(deckId: string, tempo: number, pitchBend: number): Promise<void>;
  stop(deckId: string): Promise<boolean>;
  setVolume(deckId: string, volume: number): Promise<void>;
  setTempo(deckId: string, rate: number): Promise<void>;
  setPitchBend(deckId: string, amount: number): Promise<void>;
  setLoop(deckId: string, isLooping: boolean): Promise<void>;
  getControlDiagnostics(): Promise<Record<string, number | string | boolean>>;
  getPosition(deckId: string): Promise<number>;
  getDuration(deckId: string): Promise<number>;
  getPlaybackState(deckId: string): Promise<NativePlaybackState>;
  isDeckPlaying(deckId: string): Promise<boolean>;
  addListener(eventName: string, listener: (event: any) => void): { remove: () => void };
  removeListener(eventName: string, listener: (event: any) => void): void;
}

const nativeModule: AudioPlaybackNativeModule | null =
  Platform.OS === 'android'
    ? (requireOptionalNativeModule<AudioPlaybackNativeModule>('AudioPlayback') ?? null)
    : null;

export const isNativeAudioAvailable = (): boolean => nativeModule !== null;

export const NativeAudio = {
  isAvailable: isNativeAudioAvailable,

  async loadTrack(deckId: string, uri: string): Promise<NativeLoadResult> {
    if (!nativeModule) throw new Error('AudioPlayback module unavailable');
    return nativeModule.loadTrack(deckId, uri);
  },

  async play(deckId: string): Promise<boolean> {
    if (!nativeModule) throw new Error('AudioPlayback module unavailable');
    return nativeModule.play(deckId);
  },

  async pause(deckId: string): Promise<boolean> {
    if (!nativeModule) throw new Error('AudioPlayback module unavailable');
    return nativeModule.pause(deckId);
  },

  async seek(deckId: string, positionSeconds: number, revision = 0): Promise<number> {
    if (!nativeModule) throw new Error('AudioPlayback module unavailable');
    return nativeModule.seek(deckId, positionSeconds, revision);
  },

  async stop(deckId: string): Promise<boolean> {
    if (!nativeModule) throw new Error('AudioPlayback module unavailable');
    return nativeModule.stop(deckId);
  },

  async setMixerVolumes(volumeA: number, volumeB: number): Promise<void> {
    if (!nativeModule) return;
    return nativeModule.setMixerVolumes(volumeA, volumeB);
  },

  async setDeckRate(deckId: string, tempo: number, pitchBend: number): Promise<void> {
    if (!nativeModule) return;
    return nativeModule.setDeckRate(deckId, tempo, pitchBend);
  },

  async setVolume(deckId: string, volume: number): Promise<void> {
    if (!nativeModule) return;
    return nativeModule.setVolume(deckId, volume);
  },

  async setTempo(deckId: string, rate: number): Promise<void> {
    if (!nativeModule) return;
    return nativeModule.setTempo(deckId, rate);
  },

  async setPitchBend(deckId: string, amount: number): Promise<void> {
    if (!nativeModule) return;
    return nativeModule.setPitchBend(deckId, amount);
  },

  async setLoop(deckId: string, isLooping: boolean): Promise<void> {
    if (!nativeModule) return;
    return nativeModule.setLoop(deckId, isLooping);
  },

  async getControlDiagnostics(): Promise<Record<string, number | string | boolean>> {
    return nativeModule ? nativeModule.getControlDiagnostics() : {};
  },

  async getPosition(deckId: string): Promise<number> {
    if (!nativeModule) return 0;
    return nativeModule.getPosition(deckId);
  },

  async getDuration(deckId: string): Promise<number> {
    if (!nativeModule) return 0;
    return nativeModule.getDuration(deckId);
  },

  async getPlaybackState(deckId: string): Promise<NativePlaybackState | null> {
    if (!nativeModule) return null;
    return nativeModule.getPlaybackState(deckId);
  },

  async isDeckPlaying(deckId: string): Promise<boolean> {
    if (!nativeModule) return false;
    return nativeModule.isDeckPlaying(deckId);
  },

  addPositionListener(listener: (event: NativePositionEvent) => void): () => void {
    if (!nativeModule || typeof nativeModule.addListener !== 'function') return () => {};
    try {
      const sub = nativeModule.addListener('onPositionUpdate', listener);
      return () => {
        try {
          sub?.remove?.();
        } catch {
          // ignore
        }
      };
    } catch {
      return () => {};
    }
  },

  addPlaybackStateListener(listener: (event: NativePlaybackStateChangeEvent) => void): () => void {
    if (!nativeModule || typeof nativeModule.addListener !== 'function') return () => {};
    try {
      const sub = nativeModule.addListener('onPlaybackStateChange', listener);
      return () => {
        try {
          sub?.remove?.();
        } catch {
          // ignore
        }
      };
    } catch {
      return () => {};
    }
  },

  addTrackCompletedListener(listener: (event: NativeTrackCompletedEvent) => void): () => void {
    if (!nativeModule || typeof nativeModule.addListener !== 'function') return () => {};
    try {
      const sub = nativeModule.addListener('onTrackCompleted', listener);
      return () => {
        try {
          sub?.remove?.();
        } catch {
          // ignore
        }
      };
    } catch {
      return () => {};
    }
  },

  addErrorListener(listener: (event: NativeErrorEvent) => void): () => void {
    if (!nativeModule || typeof nativeModule.addListener !== 'function') return () => {};
    try {
      const sub = nativeModule.addListener('onError', listener);
      return () => {
        try {
          sub?.remove?.();
        } catch {
          // ignore
        }
      };
    } catch {
      return () => {};
    }
  },
};
