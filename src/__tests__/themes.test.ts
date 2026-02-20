import { describe, it, expect } from "vitest";
import { themes, getThemeById, DEFAULT_THEME_ID } from "../lib/themes";

describe("themes", () => {
  it("has 6 themes", () => {
    expect(themes.length).toBe(6);
  });

  it("all themes have required color properties", () => {
    const requiredKeys = [
      "--bear-bg",
      "--bear-sidebar",
      "--bear-text",
      "--bear-accent",
      "--bear-link",
    ];

    for (const theme of themes) {
      for (const key of requiredKeys) {
        expect(theme.colors).toHaveProperty(key);
      }
    }
  });

  it("all themes have unique ids", () => {
    const ids = themes.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each theme is either dark or light", () => {
    for (const theme of themes) {
      expect(["dark", "light"]).toContain(theme.type);
    }
  });
});

describe("getThemeById", () => {
  it("returns correct theme by id", () => {
    const theme = getThemeById("solarized-dark");
    expect(theme.name).toBe("Solarized Dark");
    expect(theme.type).toBe("dark");
  });

  it("returns default theme for invalid id", () => {
    const theme = getThemeById("nonexistent");
    expect(theme.id).toBe("dark-graphite");
  });
});

describe("DEFAULT_THEME_ID", () => {
  it("is dark-graphite", () => {
    expect(DEFAULT_THEME_ID).toBe("dark-graphite");
  });

  it("exists in themes list", () => {
    const found = themes.find((t) => t.id === DEFAULT_THEME_ID);
    expect(found).toBeDefined();
  });
});
