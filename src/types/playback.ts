import { DeckId } from './deck';

export type DeckPlaybackStatus = 'stopped' | 'playing' | 'paused' | 'loading' | 'error';
export type EngineStatus = 'ready' | 'active' | 'suspended' | 'error';

export interface PlaybackState {
  engineStatus: EngineStatus;
  deckAStatus: DeckPlaybackStatus;
  deckBStatus: DeckPlaybackStatus;
  sampleRate: number; // e.g. 48000 Hz
  bufferLatencyMs: number; // e.g. 5.3 ms
  masterClockDeck: DeckId | 'internal';
  cpuLoadPercent: number; // e.g. 7%
}
