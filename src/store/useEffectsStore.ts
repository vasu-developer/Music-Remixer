import { create } from 'zustand';
import { DeckId, EffectState, EffectType, FilterParams, EchoParams, ReverbParams, StutterParams } from '@/types';
import { getAudioEngine } from '@/core/audio';

interface EffectsStore extends EffectState {
  setTargetDeck: (target: DeckId | 'master') => void;
  toggleEffect: (type: EffectType) => Promise<void>;
  setFilterParams: (params: Partial<FilterParams>) => Promise<void>;
  setEchoParams: (params: Partial<EchoParams>) => Promise<void>;
  setReverbParams: (params: Partial<ReverbParams>) => Promise<void>;
  setStutterParams: (params: Partial<StutterParams>) => Promise<void>;
  setEffectDryWet: (type: EffectType, dryWet: number) => Promise<void>;
  resetAllEffects: () => Promise<void>;
}

export const useEffectsStore = create<EffectsStore>((set, get) => ({
  targetDeck: 'A',
  filter: {
    enabled: false,
    params: {
      type: 'lp',
      cutoff: 0.5,
      resonance: 0.2,
      dryWet: 1.0,
    },
  },
  echo: {
    enabled: false,
    params: {
      beats: 0.5,
      feedback: 0.4,
      dryWet: 0.5,
    },
  },
  reverb: {
    enabled: false,
    params: {
      size: 0.6,
      decay: 0.5,
      dryWet: 0.4,
    },
  },
  stutter: {
    enabled: false,
    params: {
      division: '1/8',
      dryWet: 0.8,
      isHeld: false,
    },
  },

  setTargetDeck: (target) => {
    set({ targetDeck: target });
  },

  toggleEffect: async (type) => {
    const currentState = get()[type];
    const newEnabled = !currentState.enabled;
    const target = get().targetDeck;

    const engine = getAudioEngine();
    await engine.setEffect(target, type, currentState.params as unknown as Record<string, unknown>, newEnabled);

    set({
      [type]: {
        ...currentState,
        enabled: newEnabled,
      },
    } as unknown as Partial<EffectsStore>);
  },

  setFilterParams: async (params) => {
    const current = get().filter;
    const updatedParams = { ...current.params, ...params };
    const engine = getAudioEngine();
    await engine.setEffect(get().targetDeck, 'filter', updatedParams as unknown as Record<string, unknown>, current.enabled);

    set({
      filter: {
        ...current,
        params: updatedParams,
      },
    });
  },

  setEchoParams: async (params) => {
    const current = get().echo;
    const updatedParams = { ...current.params, ...params };
    const engine = getAudioEngine();
    await engine.setEffect(get().targetDeck, 'echo', updatedParams as unknown as Record<string, unknown>, current.enabled);

    set({
      echo: {
        ...current,
        params: updatedParams,
      },
    });
  },

  setReverbParams: async (params) => {
    const current = get().reverb;
    const updatedParams = { ...current.params, ...params };
    const engine = getAudioEngine();
    await engine.setEffect(get().targetDeck, 'reverb', updatedParams as unknown as Record<string, unknown>, current.enabled);

    set({
      reverb: {
        ...current,
        params: updatedParams,
      },
    });
  },

  setStutterParams: async (params) => {
    const current = get().stutter;
    const updatedParams = { ...current.params, ...params };
    const engine = getAudioEngine();
    await engine.setEffect(get().targetDeck, 'stutter', updatedParams as unknown as Record<string, unknown>, current.enabled);

    set({
      stutter: {
        ...current,
        params: updatedParams,
      },
    });
  },

  setEffectDryWet: async (type, dryWet) => {
    const clamped = Math.max(0, Math.min(1.0, dryWet));
    if (type === 'filter') {
      await get().setFilterParams({ dryWet: clamped });
    } else if (type === 'echo') {
      await get().setEchoParams({ dryWet: clamped });
    } else if (type === 'reverb') {
      await get().setReverbParams({ dryWet: clamped });
    } else if (type === 'stutter') {
      await get().setStutterParams({ dryWet: clamped });
    }
  },

  resetAllEffects: async () => {
    set({
      filter: { ...get().filter, enabled: false },
      echo: { ...get().echo, enabled: false },
      reverb: { ...get().reverb, enabled: false },
      stutter: { ...get().stutter, enabled: false },
    });
  },
}));
