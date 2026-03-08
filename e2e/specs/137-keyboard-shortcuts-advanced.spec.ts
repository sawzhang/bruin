/**
 * Advanced keyboard shortcut tests: Cmd+N creates note, Cmd+K opens
 * command palette with search, Cmd+Shift+P toggles pin, and Escape
 * closes the command palette.
 * Complements spec 96 (Cmd+P extras) and spec 37 (basic shortcuts).
 */
import { test, expect } from '../fixtures';

test.describe('Keyboard Shortcuts Advanced', () => {
  test('Cmd+N creates a new note and shows the editor', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+n');

    await expect(app.editorPanel).toBeVisible();
    await expect(app.editorTitle).toBeVisible();
    await expect(app.editorTitle).toHaveValue('Untitled');
  });

  test('Cmd+K opens command palette, type query, Enter opens first result', async ({ app }) => {
    await app.seed([
      { title: 'Searchable Note', content: 'unique findable content' },
      { title: 'Other Note', content: 'different content' },
    ]);
    await app.goto();

    await app.page.keyboard.press('Meta+k');
    await expect(app.page.getByTestId('command-palette')).toBeVisible();

    await app.page.getByTestId('command-palette-input').fill('Searchable');
    await expect(
      app.page.getByTestId('search-result').filter({ hasText: 'Searchable Note' }),
    ).toBeVisible();

    await app.page.keyboard.press('Enter');

    // Command palette should close and the note should be open in editor
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
    await expect(app.editorTitle).toHaveValue('Searchable Note');
  });

  test('Cmd+Shift+P toggles pin on the selected note', async ({ app }) => {
    await app.seed([{ title: 'Pin Toggle Note', is_pinned: false }]);
    await app.goto();

    await app.noteItem('Pin Toggle Note').click();
    await expect(app.editorTitle).toHaveValue('Pin Toggle Note');

    // Pin the note
    await app.page.keyboard.press('Meta+Shift+p');
    await expect(app.noteItem('Pin Toggle Note').getByTestId('note-pin-icon')).toBeVisible();

    // Command palette should NOT have opened
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('Escape closes the command palette', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+k');
    await expect(app.page.getByTestId('command-palette')).toBeVisible();

    await app.page.keyboard.press('Escape');
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });
});
