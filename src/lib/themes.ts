export interface ThemeColors {
  "--bear-bg": string;
  "--bear-sidebar": string;
  "--bear-list": string;
  "--bear-editor": string;
  "--bear-hover": string;
  "--bear-active": string;
  "--bear-border": string;
  "--bear-text": string;
  "--bear-text-secondary": string;
  "--bear-text-muted": string;
  "--bear-accent": string;
  "--bear-accent-hover": string;
  "--bear-tag": string;
  "--bear-tag-bg": string;
  "--bear-link": string;
  "--bear-inline-code": string;
}

export interface Theme {
  id: string;
  name: string;
  type: "dark" | "light";
  colors: ThemeColors;
}

export const themes: Theme[] = [
  {
    id: "dark-graphite",
    name: "Dark Graphite",
    type: "dark",
    colors: {
      "--bear-bg": "#1d1d1d",
      "--bear-sidebar": "#252525",
      "--bear-list": "#2a2a2a",
      "--bear-editor": "#1d1d1d",
      "--bear-hover": "#333333",
      "--bear-active": "#3a3a3a",
      "--bear-border": "#3a3a3a",
      "--bear-text": "#e0e0e0",
      "--bear-text-secondary": "#999999",
      "--bear-text-muted": "#666666",
      "--bear-accent": "#d63031",
      "--bear-accent-hover": "#e74c3c",
      "--bear-tag": "#e17055",
      "--bear-tag-bg": "#3d2520",
      "--bear-link": "#74b9ff",
      "--bear-inline-code": "#2d2d2d",
    },
  },
  {
    id: "red-graphite",
    name: "Red Graphite",
    type: "light",
    colors: {
      "--bear-bg": "#ffffff",
      "--bear-sidebar": "#f5f5f5",
      "--bear-list": "#fafafa",
      "--bear-editor": "#ffffff",
      "--bear-hover": "#ebebeb",
      "--bear-active": "#e0e0e0",
      "--bear-border": "#d9d9d9",
      "--bear-text": "#1a1a1a",
      "--bear-text-secondary": "#666666",
      "--bear-text-muted": "#999999",
      "--bear-accent": "#d63031",
      "--bear-accent-hover": "#e74c3c",
      "--bear-tag": "#c0392b",
      "--bear-tag-bg": "#fde8e8",
      "--bear-link": "#2980b9",
      "--bear-inline-code": "#f0f0f0",
    },
  },
  {
    id: "charcoal",
    name: "Charcoal",
    type: "dark",
    colors: {
      "--bear-bg": "#2c3e50",
      "--bear-sidebar": "#233140",
      "--bear-list": "#2e4053",
      "--bear-editor": "#2c3e50",
      "--bear-hover": "#3d566e",
      "--bear-active": "#4a6580",
      "--bear-border": "#3d566e",
      "--bear-text": "#ecf0f1",
      "--bear-text-secondary": "#95a5a6",
      "--bear-text-muted": "#7f8c8d",
      "--bear-accent": "#e17055",
      "--bear-accent-hover": "#e88a73",
      "--bear-tag": "#f39c12",
      "--bear-tag-bg": "#3e3122",
      "--bear-link": "#74b9ff",
      "--bear-inline-code": "#34495e",
    },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    type: "light",
    colors: {
      "--bear-bg": "#ffffff",
      "--bear-sidebar": "#f0f0f0",
      "--bear-list": "#f7f7f7",
      "--bear-editor": "#ffffff",
      "--bear-hover": "#e0e0e0",
      "--bear-active": "#d0d0d0",
      "--bear-border": "#cccccc",
      "--bear-text": "#000000",
      "--bear-text-secondary": "#333333",
      "--bear-text-muted": "#666666",
      "--bear-accent": "#000000",
      "--bear-accent-hover": "#333333",
      "--bear-tag": "#000000",
      "--bear-tag-bg": "#e8e8e8",
      "--bear-link": "#0000ee",
      "--bear-inline-code": "#eeeeee",
    },
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    type: "light",
    colors: {
      "--bear-bg": "#fdf6e3",
      "--bear-sidebar": "#eee8d5",
      "--bear-list": "#f5efdc",
      "--bear-editor": "#fdf6e3",
      "--bear-hover": "#e8e1ce",
      "--bear-active": "#ddd6c1",
      "--bear-border": "#d3cbb7",
      "--bear-text": "#073642",
      "--bear-text-secondary": "#586e75",
      "--bear-text-muted": "#93a1a1",
      "--bear-accent": "#b58900",
      "--bear-accent-hover": "#cb9a00",
      "--bear-tag": "#d33682",
      "--bear-tag-bg": "#f5e6ee",
      "--bear-link": "#268bd2",
      "--bear-inline-code": "#eee8d5",
    },
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    type: "dark",
    colors: {
      "--bear-bg": "#002b36",
      "--bear-sidebar": "#073642",
      "--bear-list": "#053545",
      "--bear-editor": "#002b36",
      "--bear-hover": "#0a4052",
      "--bear-active": "#0d4f63",
      "--bear-border": "#0a4052",
      "--bear-text": "#93a1a1",
      "--bear-text-secondary": "#839496",
      "--bear-text-muted": "#586e75",
      "--bear-accent": "#b58900",
      "--bear-accent-hover": "#cb9a00",
      "--bear-tag": "#d33682",
      "--bear-tag-bg": "#1a2e35",
      "--bear-link": "#268bd2",
      "--bear-inline-code": "#073642",
    },
  },
];

export const DEFAULT_THEME_ID = "dark-graphite";

export function getThemeById(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0];
}
