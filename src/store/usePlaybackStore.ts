import { create } from 'zustand';
import { DeckId, DeckPlaybackStatus, EngineStatus, PlaybackState } from '@/types';

interface PlaybackStore extends PlaybackState {
  setEngineStatus: (status: EngineStatus) => void;
  setDeckStatus: (deckId: DeckId, status: DeckPlaybackStatus) => void;
  setMasterClockDeck: (deck: DeckId | 'internal') => void;
  setBufferLatency: (latencyMs: number) => void;
  setCpuLoad: (load: number) => void;
}

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  engineStatus: 'ready',
  deckAStatus: 'stopped',
  deckBStatus: 'stopped',
  sampleRate: 48000,
  bufferLatencyMs: 5.3,
  masterClockDeck: 'A',
  cpuLoadPercent: 6.8,

  setEngineStatus: (status) => set({ engineStatus: status }),
  setDeckStatus: (deckId, status) => {
    if (deckId === 'A') {
      set({ deckAStatus: status });
    } else {
      set({ deckBStatus: status });
    }
  },
  setMasterClockDeck: (deck) => set({ masterClockDeck: deck }),
  setBufferLatency: (latencyMs) => set({ bufferLatencyMs: latencyMs }),
  setCpuLoad: (load) => set({ cpuLoadPercent: load }),
}));
