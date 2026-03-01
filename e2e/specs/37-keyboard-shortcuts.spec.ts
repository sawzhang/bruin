/**
 * Keyboard shortcut tests (useKeyboard hook)
 * Covers: Cmd+N, Cmd+,, Cmd+T, Cmd+Shift+P, Cmd+Backspace
 * (Cmd+K / Cmd+P are covered in 18-command-palette-search.spec.ts)
 */
import { test, expect } from '../fixtures';

test.describe('Keyboard Shortcuts', () => {
  test('Cmd+N creates a new note and opens the editor', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+n');

    await expect(app.editorPanel).toBeVisible();
    await expect(app.editorTitle).toBeVisible();
  });

  test('Cmd+, opens the settings panel', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+,');

    await expect(app.page.getByTestId('settings-panel')).toBeVisible();
  });

  test('Cmd+, a second time closes the settings panel', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+,');
    await expect(app.page.getByTestId('settings-panel')).toBeVisible();

    await app.page.keyboard.press('Meta+,');
    await expect(app.page.getByTestId('settings-panel')).not.toBeVisible();
  });

  test('Escape closes the settings panel', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+,');
    await expect(app.page.getByTestId('settings-panel')).toBeVisible();

    await app.page.keyboard.press('Escape');
    await expect(app.page.getByTestId('settings-panel')).not.toBeVisible();
  });

  test('Cmd+T opens the theme picker', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+t');

    await expect(app.page.getByTestId('theme-picker')).toBeVisible();
  });

  test('Cmd+T a second time closes the theme picker', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+t');
    await expect(app.page.getByTestId('theme-picker')).toBeVisible();

    await app.page.keyboard.press('Meta+t');
    await expect(app.page.getByTestId('theme-picker')).not.toBeVisible();
  });

  test('Escape closes the theme picker', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+t');
    await expect(app.page.getByTestId('theme-picker')).toBeVisible();

    await app.page.keyboard.press('Escape');
    await expect(app.page.getByTestId('theme-picker')).not.toBeVisible();
  });

  test('Cmd+Shift+P pins the selected note', async ({ app }) => {
    await app.seed([{ title: 'Pin Me', is_pinned: false }]);
    await app.goto();

    await app.noteItem('Pin Me').click();
    await app.page.keyboard.press('Meta+Shift+p');

    // Pinned note shows the pin icon
    await expect(app.noteItem('Pin Me').getByTestId('note-pin-icon')).toBeVisible();
  });

  test('Cmd+Backspace trashes the selected note', async ({ app }) => {
    await app.seed([{ title: 'Trash Me' }]);
    await app.goto();

    await app.noteItem('Trash Me').click();
    await app.page.keyboard.press('Meta+Backspace');

    // Note should no longer be in the main note list
    await expect(app.noteItem('Trash Me')).not.toBeVisible();
  });

  test('Cmd+Backspace does nothing when no note is selected', async ({ app }) => {
    await app.seed([{ title: 'Safe Note' }]);
    await app.goto();

    // No note selected — pressing Cmd+Backspace should not crash
    await app.page.keyboard.press('Meta+Backspace');

    await expect(app.noteItem('Safe Note')).toBeVisible();
  });
});
