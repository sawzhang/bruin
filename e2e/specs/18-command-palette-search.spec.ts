/**
 * Command palette search mode tests
 */
import { test, expect } from '../fixtures';

test.describe('Command Palette Search', () => {
  test('command palette opens with Cmd+K', async ({ app }) => {
    await app.goto();

    await app.page.keyboard.press('Meta+k');

    await expect(app.page.getByTestId('command-palette')).toBeVisible();
  });

  test('command palette closes with Escape', async ({ app }) => {
    await app.goto();
    await app.openCommandPalette();

    await app.page.keyboard.press('Escape');

    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('command palette closes when clicking the backdrop', async ({ app }) => {
    await app.goto();
    await app.openCommandPalette();

    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('typing a note title shows it as a search result', async ({ app }) => {
    await app.seed([
      { title: 'Meeting Recap', content: 'We discussed the roadmap.' },
    ]);
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('Meeting');

    await expect(app.page.getByTestId('search-result').filter({ hasText: 'Meeting Recap' })).toBeVisible();
  });

  test('clicking a search result opens the note in the editor', async ({ app }) => {
    await app.seed([
      { id: 'note-sr', title: 'Search Target', content: 'Findable content.' },
    ]);
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('Search Target');
    await app.page.getByTestId('search-result').filter({ hasText: 'Search Target' }).click();

    // Palette closes and note opens
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
    await expect(app.editorTitle).toHaveValue('Search Target');
  });

  test('searching with no matches shows empty state', async ({ app }) => {
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('xyzzy-no-match');

    await expect(app.page.getByText('No results found')).toBeVisible();
  });

  test('"New Note" command creates a note and closes palette', async ({ app }) => {
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'New Note' }).click();

    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
    await expect(app.editorPanel).toBeVisible();
  });

  test('command filter narrows results', async ({ app }) => {
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>settings');

    // Should show Settings but not New Note
    await expect(app.page.getByTestId('command-item').filter({ hasText: 'Settings' })).toBeVisible();
    await expect(app.page.getByTestId('command-item').filter({ hasText: 'New Note' })).not.toBeVisible();
  });
});
