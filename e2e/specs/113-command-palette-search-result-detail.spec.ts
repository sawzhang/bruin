/**
 * CommandPalette search result detail tests: spec 18 tests that a matching
 * search-result is visible and clicking it selects the note, but never checks:
 * - the "Notes" group heading rendered by <Command.Group heading="Notes">
 * - the "Commands" group heading rendered by <Command.Group heading="Commands">
 * - the preview text span inside each search result
 * - the data-note-id attribute on each search-result item
 * Complements spec 18 (search mode) and spec 65 (commands extra).
 */
import { test, expect } from '../fixtures';

test.describe('Command Palette Search Result Detail', () => {
  test('"Notes" group heading is visible when search query matches notes', async ({ app }) => {
    await app.seed([{ title: 'Heading Target Note', content: 'Some content here.' }]);
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('Heading Target');

    // The cmdk library renders heading="Notes" inside the group
    await expect(app.page.getByTestId('command-palette').getByText('Notes')).toBeVisible();
  });

  test('"Commands" group heading is visible when query is empty', async ({ app }) => {
    await app.goto();
    await app.openCommandPalette();
    // No input — commands group is shown

    await expect(app.page.getByTestId('command-palette').getByText('Commands')).toBeVisible();
  });

  test('"Commands" group heading is visible in command mode (> prefix)', async ({ app }) => {
    await app.goto();
    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');

    await expect(app.page.getByTestId('command-palette').getByText('Commands')).toBeVisible();
  });

  test('"Notes" heading does not appear when query is empty (no search results)', async ({
    app,
  }) => {
    await app.goto();
    await app.openCommandPalette();
    // Empty query shows Commands group, not Notes group

    // The word "Notes" may appear as a command label, but not as a group heading in note results
    // There are no search-result items when query is empty
    await expect(app.page.getByTestId('search-result')).toHaveCount(0);
  });

  test('search result shows the note preview text below the title', async ({ app }) => {
    await app.seed([
      { title: 'Preview Detail Note', content: 'This is the searchable preview.' },
    ]);
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('Preview Detail');

    const result = app.page.getByTestId('search-result').filter({ hasText: 'Preview Detail Note' });
    // The preview span renders note.preview below the title
    await expect(result).toContainText('searchable preview');
  });

  test('search result item has data-note-id matching the note id', async ({ app }) => {
    await app.seed([{ id: 'palette-note-id', title: 'ID Test Note' }]);
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('ID Test Note');

    await expect(
      app.page.getByTestId('search-result').filter({ hasText: 'ID Test Note' }),
    ).toHaveAttribute('data-note-id', 'palette-note-id');
  });

  test('multiple search results each have distinct data-note-id values', async ({ app }) => {
    await app.seed([
      { id: 'multi-id-a', title: 'Multi Result Alpha' },
      { id: 'multi-id-b', title: 'Multi Result Beta' },
    ]);
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('Multi Result');

    await expect(
      app.page.getByTestId('search-result').filter({ hasText: 'Multi Result Alpha' }),
    ).toHaveAttribute('data-note-id', 'multi-id-a');
    await expect(
      app.page.getByTestId('search-result').filter({ hasText: 'Multi Result Beta' }),
    ).toHaveAttribute('data-note-id', 'multi-id-b');
  });
});
