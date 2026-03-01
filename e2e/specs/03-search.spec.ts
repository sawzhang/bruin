/**
 * Search & Command Palette tests
 */
import { test, expect } from '../fixtures';

test.describe('Search & Command Palette', () => {
  test('Cmd+K opens the command palette', async ({ app }) => {
    await app.goto();

    await app.openCommandPalette();

    await expect(app.page.getByTestId('command-palette')).toBeVisible();
  });

  test('command palette shows default commands when empty', async ({ app }) => {
    await app.goto();

    await app.openCommandPalette();

    await expect(app.page.getByTestId('command-item').filter({ hasText: 'New Note' })).toBeVisible();
    await expect(app.page.getByTestId('command-item').filter({ hasText: 'Settings' })).toBeVisible();
    await expect(app.page.getByTestId('command-item').filter({ hasText: 'Change Theme' })).toBeVisible();
  });

  test('Escape closes the command palette', async ({ app }) => {
    await app.goto();
    await app.openCommandPalette();

    await app.page.keyboard.press('Escape');

    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('clicking outside backdrop closes command palette', async ({ app }) => {
    await app.goto();
    await app.openCommandPalette();

    // Click the fixed backdrop (the outer div, not the inner panel)
    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('searching notes returns matching results', async ({ app }) => {
    await app.seed([
      { title: 'Unique Title XYZ', content: 'hello' },
      { title: 'Another Note ABC', content: 'world' },
    ]);
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('XYZ');

    await expect(app.page.getByTestId('search-result').filter({ hasText: 'Unique Title XYZ' })).toBeVisible();
    await expect(app.page.getByTestId('search-result').filter({ hasText: 'Another Note ABC' })).not.toBeVisible();
  });

  test('selecting a search result opens the note in editor', async ({ app }) => {
    await app.seed([{ title: 'Find This Note', content: 'important content' }]);
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('Find This');
    await app.page.getByTestId('search-result').first().click();

    await expect(app.editorTitle).toHaveValue('Find This Note');
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('inline note search filter in note list panel works', async ({ app }) => {
    await app.seed([
      { title: 'Search Target Note', content: 'find me' },
      { title: 'Unrelated Note', content: 'ignore me' },
    ]);
    await app.goto();

    await app.searchInput.fill('Search Target');

    await expect(app.noteItem('Search Target Note')).toBeVisible();
    await expect(app.noteItem('Unrelated Note')).not.toBeVisible();
  });

  test('clearing inline search shows all notes again', async ({ app }) => {
    await app.seed([
      { title: 'Note One' },
      { title: 'Note Two' },
    ]);
    await app.goto();

    await app.searchInput.fill('Note One');
    await expect(app.noteItem('Note Two')).not.toBeVisible();

    await app.searchInput.clear();
    await expect(app.noteItem('Note Two')).toBeVisible();
  });

  test('command palette > prefix shows filtered commands only', async ({ app }) => {
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>settings');

    await expect(app.page.getByTestId('command-item').filter({ hasText: 'Settings' })).toBeVisible();
    // New Note command should not appear when filtered to "settings"
    await expect(app.page.getByTestId('command-item').filter({ hasText: 'New Note' })).not.toBeVisible();
  });
});
