import { Track } from './track';

export type DeckId = 'A' | 'B';

export interface DeckState {
  id: DeckId;
  loadedTrack: Track | null;
  isPlaying: boolean;
  currentTime: number; // in seconds
  duration: number; // in seconds
  tempo: number; // 1.0 = normal, 0.92 = -8%, 1.08 = +8%
  pitchBend: number; // momentary nudge (-1.0 to +1.0)
  bpm: number; // effective BPM (loadedTrack.bpm * tempo)
  key: string;
  isSyncActive: boolean;
  isMaster: boolean;
  cuePoint: number; // cue point in seconds
  isCuePressed: boolean;
  isLooping: boolean;
  loopLengthBars: number; // 1, 2, 4, 8, 16
  volume: number; // channel fader (0.0 to 1.0)
  gain: number; // trim gain (0.0 to 1.0, center 0.5)
}
