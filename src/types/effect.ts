import { DeckId } from './deck';

export type EffectType = 'filter' | 'echo' | 'reverb' | 'stutter';

export interface FilterParams {
  type: 'lp' | 'hp';
  cutoff: number; // 0.0 to 1.0 (center 0.5 is neutral/bypass)
  resonance: number; // 0.0 to 1.0
  dryWet: number; // 0.0 to 1.0
}

export interface EchoParams {
  beats: number; // 0.25 (1/4), 0.5 (1/2), 0.75 (3/4), 1.0 (1 beat), 2.0 (2 beats)
  feedback: number; // 0.0 to 1.0
  dryWet: number; // 0.0 to 1.0
}

export interface ReverbParams {
  size: number; // 0.0 to 1.0
  decay: number; // 0.0 to 1.0
  dryWet: number; // 0.0 to 1.0
}

export interface StutterParams {
  division: '1/4' | '1/8' | '1/16' | '1/32';
  dryWet: number; // 0.0 to 1.0
  isHeld: boolean;
}

export interface EffectState {
  targetDeck: DeckId | 'master';
  filter: {
    enabled: boolean;
    params: FilterParams;
  };
  echo: {
    enabled: boolean;
    params: EchoParams;
  };
  reverb: {
    enabled: boolean;
    params: ReverbParams;
  };
  stutter: {
    enabled: boolean;
    params: StutterParams;
  };
}
