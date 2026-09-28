import { create } from 'zustand';
import { DeckId, EQBand, CrossfaderCurve, DeckEQ, StereoMeter, MixerState } from '@/types';
import { getAudioEngine } from '@/core/audio';

interface MixerStore extends MixerState {
  setCrossfader: (position: number) => Promise<void>;
  setMasterVolume: (volume: number) => Promise<void>;
  setHeadphoneVolume: (volume: number) => void;
  setCueMix: (mix: number) => void;
  setEQ: (deckId: DeckId, band: EQBand, value: number) => Promise<void>;
  toggleEQKill: (deckId: DeckId, band: EQBand) => Promise<void>;
  resetEQ: (deckId: DeckId) => Promise<void>;
  toggleCue: (deckId: DeckId) => void;
  setCrossfaderCurve: (curve: CrossfaderCurve) => void;
  updateMeters: (meters: { deckA: StereoMeter; deckB: StereoMeter; master: StereoMeter }) => void;
}

const defaultEQ = (): DeckEQ => ({
  low: 0.0,
  mid: 0.0,
  high: 0.0,
  lowKill: false,
  midKill: false,
  highKill: false,
});

export const useMixerStore = create<MixerStore>((set, get) => ({
  crossfader: 0.0,
  masterVolume: 0.85,
  headphoneVolume: 0.7,
  cueMix: 0.5,
  cueA: false,
  cueB: false,
  eqA: defaultEQ(),
  eqB: defaultEQ(),
  crossfaderCurve: 'smooth',
  channelVuA: { left: 0, right: 0 },
  channelVuB: { left: 0, right: 0 },
  masterVu: { left: 0, right: 0 },

  setCrossfader: async (position: number) => {
    const clamped = Math.max(-1.0, Math.min(1.0, position));
    const engine = getAudioEngine();
    set({ crossfader: clamped });
    void engine.setCrossfader(clamped).catch((error) => console.warn('[Audio controls] setCrossfader failed', error));
  },

  setMasterVolume: async (volume: number) => {
    const clamped = Math.max(0.0, Math.min(1.0, volume));
    const engine = getAudioEngine();
    set({ masterVolume: clamped });
    void engine.setMasterVolume(clamped).catch((error) => console.warn('[Audio controls] setMasterVolume failed', error));
  },

  setHeadphoneVolume: (volume: number) => {
    set({ headphoneVolume: Math.max(0, Math.min(1, volume)) });
  },

  setCueMix: (mix: number) => {
    set({ cueMix: Math.max(0, Math.min(1, mix)) });
  },

  setEQ: async (deckId: DeckId, band: EQBand, value: number) => {
    const eqKey = deckId === 'A' ? 'eqA' : 'eqB';
    const currentEQ = get()[eqKey];
    const clampedVal = Math.max(-1.0, Math.min(1.0, value));

    const engine = getAudioEngine();

    set((state) => ({ [eqKey]: { ...state[eqKey], [band]: clampedVal } }));
    void engine.setEQ(deckId, band, clampedVal, currentEQ[`${band}Kill`]).catch((error) => console.warn('[Audio controls] setEQ failed', error));
  },

  toggleEQKill: async (deckId: DeckId, band: EQBand) => {
    const eqKey = deckId === 'A' ? 'eqA' : 'eqB';
    const currentEQ = get()[eqKey];
    const killKey = `${band}Kill` as const;
    const newKillState = !currentEQ[killKey];

    const engine = getAudioEngine();
    const effectiveValue = newKillState ? -1.0 : currentEQ[band];

    set((state) => ({ [eqKey]: { ...state[eqKey], [killKey]: newKillState } }));
    void engine.setEQ(deckId, band, effectiveValue, newKillState).catch((error) => console.warn('[Audio controls] toggleEQKill failed', error));
  },

  resetEQ: async (deckId: DeckId) => {
    const eqKey = deckId === 'A' ? 'eqA' : 'eqB';
    const reset = defaultEQ();
    const engine = getAudioEngine();
    set({ [eqKey]: reset });
    for (const band of ['low', 'mid', 'high'] as const) {
      void engine.setEQ(deckId, band, 0, false).catch((error) => console.warn('[Audio controls] EQ reset failed', error));
    }
  },

  toggleCue: (deckId: DeckId) => {
    if (deckId === 'A') {
      set({ cueA: !get().cueA });
    } else {
      set({ cueB: !get().cueB });
    }
  },

  setCrossfaderCurve: (curve: CrossfaderCurve) => {
    set({ crossfaderCurve: curve });
    void getAudioEngine().setCrossfaderCurve?.(curve).catch((error) => console.warn('[Audio controls] crossfader curve failed', error));
  },

  updateMeters: (meters) => {
    set({
      channelVuA: meters.deckA,
      channelVuB: meters.deckB,
      masterVu: meters.master,
    });
  },
}));
