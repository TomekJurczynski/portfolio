// Source of truth for color tokens (02-SPEC-TECHNICZNA.md §2.2).
// scripts/build-palettes.ts turns this into src/styles/palettes.generated.css.
// Components must only ever reference the CSS custom properties below, never raw hex values.

export interface PaletteTokens {
  bg: string;
  surface: string;
  raised: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentText: string;
  onAccent: string;
  danger: string;
  dangerText: string;
}

export interface Palette {
  light: PaletteTokens;
  dark: PaletteTokens;
}

export const palettes: Record<'baseline' | 'cosmos', Palette> = {
  baseline: {
    light: {
      bg: '#FFFFFF',
      surface: '#F6F7F9',
      raised: '#FFFFFF',
      text: '#14171C',
      textMuted: '#5A6472',
      textSubtle: '#8A94A3',
      border: '#E1E5EA',
      borderStrong: '#7A8494',
      accent: '#2563EB',
      accentText: '#2563EB',
      onAccent: '#FFFFFF',
      danger: '#B42318',
      dangerText: '#B42318',
    },
    dark: {
      bg: '#0E1116',
      surface: '#161B22',
      raised: '#1C222B',
      text: '#E8ECF1',
      textMuted: '#9AA5B4',
      textSubtle: '#6B7686',
      border: '#2A313B',
      borderStrong: '#6B7686',
      accent: '#6EA8FF',
      accentText: '#6EA8FF',
      onAccent: '#0E1116',
      danger: '#FF8A80',
      dangerText: '#FF8A80',
    },
  },
  // Owner's palette, with WCAG AA contrast corrections applied (spec §2.2 "Korekty dostępności").
  // Original Cosmos values that failed contrast now live only in textSubtle/accent/danger
  // (decorative / non-text uses); text-bearing roles use the corrected hex.
  cosmos: {
    light: {
      bg: '#FDFEFF',
      surface: '#E8EEF8',
      raised: '#FFFFFF',
      text: '#1B1F2B',
      textMuted: '#5F6B7E',
      textSubtle: '#8B95A7',
      border: '#D5DDE8',
      borderStrong: '#6E7A8E',
      accent: '#4F8BFF',
      accentText: '#2A5FD0',
      onAccent: '#1B1F2B',
      danger: '#EF6B6B',
      dangerText: '#C23636',
    },
    dark: {
      bg: '#0B0F17',
      surface: '#121826',
      raised: '#121826',
      text: '#D6E1F2',
      textMuted: '#7E8FA6',
      textSubtle: '#6B7C93',
      border: '#1F2837',
      borderStrong: '#6B7C93',
      accent: '#5BA3FF',
      accentText: '#5BA3FF',
      onAccent: '#080B11',
      danger: '#FF8A80',
      dangerText: '#FF8A80',
    },
  },
};
