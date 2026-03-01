/**
 * Keyboard shortcut extra tests: Cmd+P opens the command palette (the
 * useKeyboard hook maps both Cmd+K and Cmd+P to toggleCommandPalette, but
 * spec 18 only tests Cmd+K; Cmd+P is untested). Also covers Cmd+P toggle
 * (second press closes) and mutual exclusivity with other panels.
 * Complements spec 18 (command palette search) and spec 37 (keyboard shortcuts).
 */
import { test, expect } from '../fixtures';

test.describe('Keyboard Shortcut Extras', () => {
  test('Cmd+P opens the command palette', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+p');

    await expect(app.page.getByTestId('command-palette')).toBeVisible();
  });

  test('Cmd+P a second time closes the command palette', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+p');
    await expect(app.page.getByTestId('command-palette')).toBeVisible();

    await app.page.keyboard.press('Meta+p');
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('Escape closes command palette opened via Cmd+P', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+p');
    await expect(app.page.getByTestId('command-palette')).toBeVisible();

    await app.page.keyboard.press('Escape');
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('command palette opened via Cmd+P accepts input', async ({ app }) => {
    await app.seed([{ title: 'CmdP Search Note', content: 'findable' }]);
    await app.goto();

    await app.page.keyboard.press('Meta+p');
    await app.page.getByTestId('command-palette-input').fill('CmdP Search');

    await expect(
      app.page.getByTestId('search-result').filter({ hasText: 'CmdP Search Note' }),
    ).toBeVisible();
  });

  test('Cmd+K and Cmd+P both toggle the same command palette', async ({ app }) => {
    await app.goto();

    // Open with Cmd+K
    await app.page.keyboard.press('Meta+k');
    await expect(app.page.getByTestId('command-palette')).toBeVisible();

    // Close with Cmd+P (same toggle)
    await app.page.keyboard.press('Meta+p');
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('Cmd+Shift+P pins the note (not affected by Cmd+P shortcut)', async ({ app }) => {
    await app.seed([{ title: 'Pin Guard Note', is_pinned: false }]);
    await app.goto();
    await app.noteItem('Pin Guard Note').click();

    // Cmd+Shift+P must pin — not open the command palette
    await app.page.keyboard.press('Meta+Shift+p');

    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
    await expect(app.noteItem('Pin Guard Note').getByTestId('note-pin-icon')).toBeVisible();
  });
});
