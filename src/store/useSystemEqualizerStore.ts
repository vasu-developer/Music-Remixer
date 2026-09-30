import { create } from 'zustand';
import { getAudioEngine } from '@/core/audio';
import { MASTER_DEFAULTS, clampMasterValue } from '@/core/audio/systemEqualizer';

interface MasterSoundState {
  values: number[];
  error: string | null;
  setValue: (index: number, value: number) => void;
  reset: () => void;
  apply: () => void;
}
export const useSystemEqualizerStore = create<MasterSoundState>((set, get) => ({
  values: [...MASTER_DEFAULTS], error: null,
  setValue: (index, input) => {
    try {
      const value = clampMasterValue(index, input);
      const engine = getAudioEngine();
      if (!engine.setMasterFx) throw new Error('Master sound requires the updated Android app.');
      engine.setMasterFx(index, value);
      set(s => ({ values: s.values.map((v, i) => i === index ? value : v), error: null }));
    } catch (e) { set({ error: e instanceof Error ? e.message : 'Could not apply sound settings.' }); }
  },
  apply: () => {
    try {
      const engine = getAudioEngine();
      if (!engine.setMasterFx) throw new Error('Master sound requires the updated Android app.');
      get().values.forEach((v, i) => engine.setMasterFx!(i, v));
      set({ error: null });
    } catch (e) { set({ error: e instanceof Error ? e.message : 'Could not apply sound settings.' }); }
  },
  reset: () => {
    // Keep a failed reset visible; never claim native controls changed on failure.
    MASTER_DEFAULTS.forEach((v, i) => get().setValue(i, v));
  },
}));
