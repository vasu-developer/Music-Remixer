import { Platform, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const DJColors = {
  // Console chassis & plates
  chassis: '#090A0D',
  surface: '#111317',
  surfaceRaised: '#171A21',
  surfaceInset: '#0E1014',

  // Borders
  borderSubtle: '#21252D',
  borderStrong: '#2F3540',
  borderHighlight: '#3E4554',

  // Deck accents
  deckA: '#00E5FF', // Electric Cyan
  deckAGlow: 'rgba(0, 229, 255, 0.25)',
  deckADark: '#08333D',

  deckB: '#FF9100', // Amber Flare
  deckBGlow: 'rgba(255, 145, 0, 0.25)',
  deckBDark: '#472900',

  // Functional accents
  master: '#FF2A4D', // Red indicator
  cue: '#00B0FF', // Cue blue
  sync: '#00E676', // Green active
  syncGlow: 'rgba(0, 230, 118, 0.25)',
  warning: '#FFD600',

  // Typography
  textPrimary: '#F1F3F7',
  textSecondary: '#8B93A2',
  textMuted: '#4D5462',
  textDeckA: '#66EFFF',
  textDeckB: '#FFA833',

  // Hardware controls
  platter: '#13151A',
  platterRim: '#252932',
  faderTrack: '#0A0B0E',
  faderCap: '#262A33',
  faderCapBorder: '#454C5B',
  knobBase: '#15171D',
  knobCap: '#20242D',

  // VU Meter segments
  vuGreen: '#00E676',
  vuYellow: '#FFD600',
  vuRed: '#FF1744',
  vuOff: '#191C22',
} as const;

export const Colors = {
  light: {
    text: DJColors.textPrimary,
    background: DJColors.chassis,
    backgroundElement: DJColors.surface,
    backgroundSelected: DJColors.surfaceRaised,
    textSecondary: DJColors.textSecondary,
  },
  dark: {
    text: DJColors.textPrimary,
    background: DJColors.chassis,
    backgroundElement: DJColors.surface,
    backgroundSelected: DJColors.surfaceRaised,
    textSecondary: DJColors.textSecondary,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = {
  sans: 'normal',
  serif: 'serif',
  rounded: 'normal',
  mono: 'monospace',
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const DJFonts = {
  display: Platform.select({ ios: 'System', default: 'sans-serif-medium' }),
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  condensed: Platform.select({ ios: 'System', default: 'sans-serif-condensed' }),
};

export const DJSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const DJTouchTargets = {
  min: 44,
  buttonSmall: 36,
  buttonStandard: 44,
  buttonLarge: 52,
  knobSmall: 48,
  knobStandard: 56,
  jogWheelSmall: 140,
  jogWheelStandard: 170,
};

export const Layout = {
  window: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  isSmallDevice: SCREEN_WIDTH < 375,
  isTablet: SCREEN_WIDTH >= 768,
};

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 900;
