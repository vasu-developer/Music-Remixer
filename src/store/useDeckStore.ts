import { ControlTrace } from '@/core/audio/controlTrace';
import { create } from 'zustand';
import { DeckId, DeckState, Track } from '@/types';
import { getAudioEngine } from '@/core/audio';
import { MOCK_TRACKS } from '@/constants/mockTracks';

interface DeckStore {
  deckA: DeckState;
  deckB: DeckState;

  loadTrack: (deckId: DeckId, track: Track) => Promise<void>;
  play: (deckId: DeckId, trace?: ControlTrace) => Promise<void>;
  pause: (deckId: DeckId, trace?: ControlTrace) => Promise<void>;
  togglePlay: (deckId: DeckId, trace?: ControlTrace) => Promise<void>;
  seek: (deckId: DeckId, positionSeconds: number) => Promise<void>;
  setTempo: (deckId: DeckId, tempo: number) => Promise<void>;
  setPitchBend: (deckId: DeckId, amount: number) => Promise<void>;
  setCue: (deckId: DeckId) => void;
  pressCue: (deckId: DeckId) => Promise<void>;
  releaseCue: (deckId: DeckId) => Promise<void>;
  toggleSync: (deckId: DeckId) => Promise<void>;
  setVolume: (deckId: DeckId, volume: number, seq?: number, tGesture?: number) => Promise<void>;
  setGain: (deckId: DeckId, gain: number) => Promise<void>;
  scratch: (deckId: DeckId, deltaVelocity: number) => Promise<void>;
  updatePosition: (deckId: DeckId, position: number) => void;
  updatePlaybackState: (deckId: DeckId, playing: boolean) => void;
  toggleLoop: (deckId: DeckId) => void;
  setLoopLength: (deckId: DeckId, bars: number) => void;
  loadInitialTracks: () => Promise<void>;
}

const createInitialDeck = (id: DeckId): DeckState => ({
  id,
  loadedTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  tempo: 1.0,
  pitchBend: 0,
  bpm: 128.0,
  key: '--',
  isSyncActive: false,
  isMaster: id === 'A',
  cuePoint: 0,
  isCuePressed: false,
  isLooping: false,
  loopLengthBars: 4,
  volume: 0.85,
  gain: 0.5,
});

export const useDeckStore = create<DeckStore>((set, get) => ({
  deckA: createInitialDeck('A'),
  deckB: createInitialDeck('B'),

  loadTrack: async (deckId: DeckId, track: Track) => {
    const engine = getAudioEngine();
    const loaded = await engine.loadTrack(deckId, track);
    if (!loaded) throw new Error('Track could not be selected');

    const engineDuration = await engine.getDuration(deckId);
    const resolvedDuration = engineDuration > 0 ? engineDuration : track.duration;
    const resolvedBpm = track.bpm > 0 ? track.bpm : 128.0;

    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    set({
      [deckKey]: {
        ...get()[deckKey],
        loadedTrack: track,
        currentTime: 0,
        duration: resolvedDuration,
        bpm: resolvedBpm,
        key: track.musicalKey && track.musicalKey !== '--' ? track.musicalKey : '8A / Am',
        isPlaying: false,
        isCuePressed: false,
        isSyncActive: false,
        isLooping: false,
        tempo: 1,
        pitchBend: 0,
        cuePoint: 0,
      },
    });
  },

  play: async (deckId: DeckId, trace?: ControlTrace) => {

    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    const deck = get()[deckKey];
    if (!deck.loadedTrack) { return; }

    const engine = getAudioEngine();
    await engine.play(deckId, trace);

    set({
      [deckKey]: { ...get()[deckKey], isPlaying: true },
    });
  },

  pause: async (deckId: DeckId, trace?: ControlTrace) => {

    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    const engine = getAudioEngine();
    await engine.pause(deckId, trace);

    set({
      [deckKey]: { ...get()[deckKey], isPlaying: false },
    });
  },

  togglePlay: async (deckId: DeckId, trace?: ControlTrace) => {

    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    const deck = get()[deckKey];
    if (deck.isPlaying) {
      await get().pause(deckId, trace);
    } else {
      await get().play(deckId, trace);
    }
  },

  seek: async (deckId: DeckId, positionSeconds: number) => {
    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    const deck = get()[deckKey];
    const clampedPos = Math.max(0, Math.min(positionSeconds, deck.duration));

    const engine = getAudioEngine();

    set({
      [deckKey]: { ...get()[deckKey], currentTime: clampedPos },
    });
    void engine.seek(deckId, clampedPos).catch((error) => console.warn('[Audio controls] seek failed', error));
  },

  setTempo: async (deckId: DeckId, tempo: number) => {
    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    const deck = get()[deckKey];
    const clampedTempo = Math.max(0.5, Math.min(2.0, tempo));

    const engine = getAudioEngine();

    const baseBpm = deck.loadedTrack && deck.loadedTrack.bpm > 0
      ? deck.loadedTrack.bpm
      : (deck.bpm > 0 ? Number((deck.bpm / deck.tempo).toFixed(2)) : 128.0);
    const effectiveBpm = Number((baseBpm * clampedTempo).toFixed(2));

    set({
      [deckKey]: {
        ...get()[deckKey],
        tempo: clampedTempo,
        bpm: effectiveBpm,
      },
    });
    void engine.setTempo(deckId, clampedTempo).catch((error) => console.warn('[Audio controls] setTempo failed', error));
  },

  setPitchBend: async (deckId: DeckId, amount: number) => {
    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    const engine = getAudioEngine();

    set({
      [deckKey]: { ...get()[deckKey], pitchBend: amount },
    });
    void engine.setPitchBend(deckId, amount).catch((error) => console.warn('[Audio controls] setPitchBend failed', error));
  },

  setCue: (deckId: DeckId) => {
    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    const deck = get()[deckKey];
    set({
      [deckKey]: { ...deck, cuePoint: deck.currentTime },
    });
  },

  pressCue: async (deckId: DeckId) => {
    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    const deck = get()[deckKey];
    const engine = getAudioEngine();

    if (deck.isPlaying) {
      await engine.pause(deckId);
      await engine.seek(deckId, deck.cuePoint);
      engine.flushControls?.();
      set({
        [deckKey]: {
          ...deck,
          isPlaying: false,
          currentTime: deck.cuePoint,
          isCuePressed: true,
        },
      });
    } else {
      await engine.seek(deckId, deck.cuePoint);
      engine.flushControls?.();
      await engine.play(deckId);
      set({
        [deckKey]: {
          ...deck,
          currentTime: deck.cuePoint,
          isCuePressed: true,
        },
      });
    }
  },

  releaseCue: async (deckId: DeckId) => {
    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    const deck = get()[deckKey];
    const engine = getAudioEngine();

    if (deck.isCuePressed) {
      await engine.pause(deckId);
      await engine.seek(deckId, deck.cuePoint);
      engine.flushControls?.();
      set({
        [deckKey]: {
          ...deck,
          isPlaying: false,
          currentTime: deck.cuePoint,
          isCuePressed: false,
        },
      });
    }
  },

  toggleSync: async (deckId: DeckId) => {
    const isDeckA = deckId === 'A';
    const targetKey = isDeckA ? 'deckA' : 'deckB';
    const sourceKey = isDeckA ? 'deckB' : 'deckA';

    const targetDeck = get()[targetKey];
    const sourceDeck = get()[sourceKey];

    // Local tracks have no BPM analysis in Phase 1. Never divide by zero.
    if (targetDeck.bpm <= 0 || sourceDeck.bpm <= 0) return;
    const newSyncActive = !targetDeck.isSyncActive;

    if (newSyncActive && sourceDeck.loadedTrack && targetDeck.loadedTrack) {
      const targetBaseBpm = targetDeck.loadedTrack.bpm > 0 ? targetDeck.loadedTrack.bpm : 128.0;
      const desiredBpm = sourceDeck.bpm > 0 ? sourceDeck.bpm : 128.0;
      const targetTempo = desiredBpm / targetBaseBpm;

      const engine = getAudioEngine();
      void engine.setTempo(deckId, targetTempo).catch((error) => console.warn('[Audio controls] sync failed', error));
      engine.flushControls?.();

      set({
        [targetKey]: {
          ...get()[targetKey],
          isSyncActive: true,
          tempo: targetTempo,
          bpm: desiredBpm,
        },
      });
    } else {
      set({
        [targetKey]: {
          ...get()[targetKey],
          isSyncActive: false,
        },
      });
    }
  },

  setVolume: async (deckId: DeckId, volume: number, seq?: number, tGesture?: number) => {
    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    const clamped = Math.max(0, Math.min(1.0, volume));

    const engine = getAudioEngine();

    set({
      [deckKey]: { ...get()[deckKey], volume: clamped },
    });
    void engine.setVolume(deckId, clamped, seq, tGesture).catch((error) => console.warn('[Audio controls] setVolume failed', error));
  },

  setGain: async (deckId: DeckId, gain: number) => {
    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    const clamped = Math.max(0, Math.min(1.0, gain));

    const engine = getAudioEngine();

    set({
      [deckKey]: { ...get()[deckKey], gain: clamped },
    });
    void engine.setGain(deckId, clamped).catch((error) => console.warn('[Audio controls] setGain failed', error));
  },

  scratch: async (deckId: DeckId, deltaVelocity: number) => {
    const engine = getAudioEngine();
    void engine.scratch(deckId, deltaVelocity).catch((error) => console.warn('[Audio controls] scratch failed', error));
  },

  updatePosition: (deckId: DeckId, position: number) => {
    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    set({
      [deckKey]: { ...get()[deckKey], currentTime: position },
    });
  },

  updatePlaybackState: (deckId: DeckId, playing: boolean) => {
    const key = deckId === 'A' ? 'deckA' : 'deckB';
    if (get()[key].isPlaying !== playing) {
      set({ [key]: { ...get()[key], isPlaying: playing } });
    }
  },

  toggleLoop: (deckId: DeckId) => {
    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    const deck = get()[deckKey];
    set({
      [deckKey]: { ...deck, isLooping: !deck.isLooping },
    });
  },

  setLoopLength: (deckId: DeckId, bars: number) => {
    const deckKey = deckId === 'A' ? 'deckA' : 'deckB';
    set({
      [deckKey]: { ...get()[deckKey], loopLengthBars: bars },
    });
  },

  loadInitialTracks: async () => {
    const { deckA, deckB, loadTrack } = get();
    if (!deckA.loadedTrack && MOCK_TRACKS.length > 0) {
      await loadTrack('A', MOCK_TRACKS[0]);
    }
    if (!deckB.loadedTrack && MOCK_TRACKS.length > 1) {
      await loadTrack('B', MOCK_TRACKS[1]);
    }
  },
}));
