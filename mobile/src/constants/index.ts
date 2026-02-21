// Colors derived from Bruin desktop themes (dark-graphite + red-graphite)
export const Colors = {
  dark: {
    bg: "#1d1d1d",
    surface: "#252525",
    surfaceSecondary: "#2a2a2a",
    hover: "#333333",
    active: "#3a3a3a",
    border: "#3a3a3a",
    text: "#e0e0e0",
    textSecondary: "#999999",
    textMuted: "#666666",
    accent: "#d63031",
    accentHover: "#e74c3c",
    tag: "#e17055",
    tagBg: "#3d2520",
    link: "#74b9ff",
    inlineCode: "#2d2d2d",
  },
  light: {
    bg: "#ffffff",
    surface: "#f5f5f5",
    surfaceSecondary: "#fafafa",
    hover: "#ebebeb",
    active: "#e0e0e0",
    border: "#d9d9d9",
    text: "#1a1a1a",
    textSecondary: "#666666",
    textMuted: "#999999",
    accent: "#d63031",
    accentHover: "#e74c3c",
    tag: "#c0392b",
    tagBg: "#fde8e8",
    link: "#2980b9",
    inlineCode: "#f0f0f0",
  },
} as const;

// Typography
export const Typography = {
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 20,
    fontWeight: "600" as const,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontWeight: "400" as const,
    lineHeight: 18,
  },
  small: {
    fontSize: 11,
    fontWeight: "500" as const,
    lineHeight: 16,
  },
  mono: {
    fontFamily: "Menlo",
    fontSize: 14,
  },
} as const;

// Spacing
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Border Radius
export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;

// Storage keys (expo-secure-store)
export const StorageKeys = {
  THEME: "bruin-theme",
  SYNC_ON_LAUNCH: "bruin-sync-on-launch",
  LAST_SYNC: "bruin-last-sync",
} as const;

// Note preview length
export const NOTE_PREVIEW_LENGTH = 120;

// Debounce durations (ms)
export const DEBOUNCE_SEARCH = 300;
export const DEBOUNCE_AUTOSAVE = 2000;
