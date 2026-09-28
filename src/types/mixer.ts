export type EQBand = 'low' | 'mid' | 'high';

export interface DeckEQ {
  low: number; // -1.0 to 1.0 (center 0.0 is unity 0dB)
  mid: number;
  high: number;
  lowKill: boolean;
  midKill: boolean;
  highKill: boolean;
}

export type CrossfaderCurve = 'linear' | 'cut' | 'smooth';

export interface StereoMeter {
  left: number; // 0.0 to 1.0
  right: number; // 0.0 to 1.0
}

export interface MixerState {
  crossfader: number; // -1.0 (Deck A 100%) to 0.0 (Equal) to 1.0 (Deck B 100%)
  masterVolume: number; // 0.0 to 1.0
  headphoneVolume: number; // 0.0 to 1.0
  cueMix: number; // 0.0 (Cue) to 1.0 (Master)
  cueA: boolean;
  cueB: boolean;
  eqA: DeckEQ;
  eqB: DeckEQ;
  crossfaderCurve: CrossfaderCurve;
  channelVuA: StereoMeter;
  channelVuB: StereoMeter;
  masterVu: StereoMeter;
}
