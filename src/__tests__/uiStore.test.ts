import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../stores/uiStore";

beforeEach(() => {
  // Reset zustand store to defaults
  useUIStore.setState({
    sidebarWidth: 220,
    noteListWidth: 280,
    isCommandPaletteOpen: false,
    isThemePickerOpen: false,
    theme: "dark-graphite",
  });
});

describe("useUIStore", () => {
  it("has correct default values", () => {
    const state = useUIStore.getState();
    expect(state.sidebarWidth).toBe(220);
    expect(state.noteListWidth).toBe(280);
    expect(state.isCommandPaletteOpen).toBe(false);
    expect(state.isThemePickerOpen).toBe(false);
  });

  it("setSidebarWidth clamps to min 160", () => {
    useUIStore.getState().setSidebarWidth(100);
    expect(useUIStore.getState().sidebarWidth).toBe(160);
  });

  it("setSidebarWidth clamps to max 400", () => {
    useUIStore.getState().setSidebarWidth(500);
    expect(useUIStore.getState().sidebarWidth).toBe(400);
  });

  it("setNoteListWidth clamps to min 200", () => {
    useUIStore.getState().setNoteListWidth(100);
    expect(useUIStore.getState().noteListWidth).toBe(200);
  });

  it("setNoteListWidth clamps to max 500", () => {
    useUIStore.getState().setNoteListWidth(600);
    expect(useUIStore.getState().noteListWidth).toBe(500);
  });

  it("toggleCommandPalette toggles state", () => {
    expect(useUIStore.getState().isCommandPaletteOpen).toBe(false);
    useUIStore.getState().toggleCommandPalette();
    expect(useUIStore.getState().isCommandPaletteOpen).toBe(true);
    useUIStore.getState().toggleCommandPalette();
    expect(useUIStore.getState().isCommandPaletteOpen).toBe(false);
  });

  it("toggleThemePicker toggles state", () => {
    expect(useUIStore.getState().isThemePickerOpen).toBe(false);
    useUIStore.getState().toggleThemePicker();
    expect(useUIStore.getState().isThemePickerOpen).toBe(true);
  });

  it("setTheme updates theme", () => {
    useUIStore.getState().setTheme("solarized-dark");
    expect(useUIStore.getState().theme).toBe("solarized-dark");
  });
});
