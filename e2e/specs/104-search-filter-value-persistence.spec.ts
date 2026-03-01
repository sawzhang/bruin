/**
 * Note search filter value-persistence tests: the NoteList search input
 * uses local React state (`searchFilter`) that persists across tag/workspace
 * filter changes and view navigations. Spec 58 tests that correct notes
 * are visible after switching tags while searching, but never asserts
 * `toHaveValue()` on the input — the actual text retention is untested.
 * Complements spec 58 (combined filters) and spec 75 (input attributes).
 */
import { test, expect } from '../fixtures';

test.describe('Search Filter Value Persistence', () => {
  test('search input retains its value after clicking a different tag', async ({ app }) => {
    await app.seed([
      { title: 'Work Alpha', tags: ['work'] },
      { title: 'Personal Alpha', tags: ['personal'] },
    ]);
    await app.goto();

    await app.page.getByTestId('note-search-input').fill('Alpha');
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();

    await expect(app.page.getByTestId('note-search-input')).toHaveValue('Alpha');
  });

  test('search input retains its value after switching to a second tag', async ({ app }) => {
    await app.seed([
      { title: 'Dev Note', tags: ['dev'] },
      { title: 'Design Note', tags: ['design'] },
    ]);
    await app.goto();

    await app.page.getByTestId('note-search-input').fill('Note');
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'dev' }).click();

    // Switch to a different tag
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'design' }).click();

    await expect(app.page.getByTestId('note-search-input')).toHaveValue('Note');
  });

  test('search input retains value after clicking "All Notes"', async ({ app }) => {
    await app.seed([
      { title: 'Retain Me', tags: ['keep'] },
    ]);
    await app.goto();

    await app.page.getByTestId('note-search-input').fill('Retain');
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'keep' }).click();

    await app.navAllNotes.click();

    // Search text is local state — not cleared by nav
    await expect(app.page.getByTestId('note-search-input')).toHaveValue('Retain');
  });

  test('search input retains value when switching from tag filter to trash view', async ({
    app,
  }) => {
    await app.seed([{ title: 'Tagged Persist Note', tags: ['persist'] }]);
    await app.goto();

    await app.page.getByTestId('note-search-input').fill('Persist');
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'persist' }).click();

    await app.navTrash.click();

    await expect(app.page.getByTestId('note-search-input')).toHaveValue('Persist');
  });

  test('search input value is empty by default (no persistence on fresh load)', async ({
    app,
  }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-search-input')).toHaveValue('');
  });

  test('search input value updates as user types', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('note-search-input').fill('hello world');

    await expect(app.page.getByTestId('note-search-input')).toHaveValue('hello world');
  });

  test('search input value is empty after clear()', async ({ app }) => {
    await app.seed([{ title: 'Clear Value Note' }]);
    await app.goto();

    await app.page.getByTestId('note-search-input').fill('Clear');
    await expect(app.page.getByTestId('note-search-input')).toHaveValue('Clear');

    await app.page.getByTestId('note-search-input').clear();

    await expect(app.page.getByTestId('note-search-input')).toHaveValue('');
  });
});
