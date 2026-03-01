/**
 * Note list search in trash view: the same debouncedFilter that applies to
 * regular notes also applies when showTrash is true — the NoteList `sorted`
 * useMemo filters trashed notes by title/preview just like regular notes.
 * No prior spec tests that typing in the search input actually narrows the
 * trash list. Spec 75 only tests that the search input is *visible* in trash.
 * Complements spec 29 (search), spec 59 (trash extras), spec 75 (input visibility).
 */
import { test, expect } from '../fixtures';

async function seedTrashedNotes(
  app: import('../page-objects/AppPage').AppPage,
  entries: { title: string; content?: string }[],
) {
  await app.page.addInitScript((items: { title: string; content?: string }[]) => {
    const now = new Date().toISOString();
    items.forEach((item, i) => {
      window.__TAURI_MOCK_DB__.notes.push({
        id: `trash-search-${i}`,
        title: item.title,
        content: item.content ?? '',
        state: 'draft',
        is_pinned: false,
        deleted: true,
        word_count: 0,
        tags: [],
        workspace_id: null,
        created_at: now,
        updated_at: now,
        version: 1,
      });
    });
  }, entries);
}

test.describe('Note List Search in Trash View', () => {
  test('search input filters trashed notes by title', async ({ app }) => {
    await seedTrashedNotes(app, [
      { title: 'Trashed Alpha Note' },
      { title: 'Trashed Beta Note' },
    ]);
    await app.goto();
    await app.navTrash.click();

    await app.page.getByTestId('note-search-input').fill('Alpha');

    await expect(
      app.page.getByTestId('note-item').filter({ hasText: 'Trashed Alpha Note' }),
    ).toBeVisible();
    await expect(
      app.page.getByTestId('note-item').filter({ hasText: 'Trashed Beta Note' }),
    ).not.toBeVisible();
  });

  test('search in trash is case-insensitive', async ({ app }) => {
    await seedTrashedNotes(app, [{ title: 'Trashed CaseCheck Note' }]);
    await app.goto();
    await app.navTrash.click();

    await app.page.getByTestId('note-search-input').fill('casecheck');

    await expect(
      app.page.getByTestId('note-item').filter({ hasText: 'Trashed CaseCheck Note' }),
    ).toBeVisible();
  });

  test('clearing search in trash restores all trashed notes', async ({ app }) => {
    await seedTrashedNotes(app, [
      { title: 'Trash Restore A' },
      { title: 'Trash Restore B' },
    ]);
    await app.goto();
    await app.navTrash.click();

    await app.page.getByTestId('note-search-input').fill('Restore A');
    await expect(
      app.page.getByTestId('note-item').filter({ hasText: 'Trash Restore B' }),
    ).not.toBeVisible();

    await app.page.getByTestId('note-search-input').clear();

    await expect(
      app.page.getByTestId('note-item').filter({ hasText: 'Trash Restore A' }),
    ).toBeVisible();
    await expect(
      app.page.getByTestId('note-item').filter({ hasText: 'Trash Restore B' }),
    ).toBeVisible();
  });

  test('search in trash with no match shows note-list-empty', async ({ app }) => {
    await seedTrashedNotes(app, [{ title: 'Trash No Match Note' }]);
    await app.goto();
    await app.navTrash.click();

    await app.page.getByTestId('note-search-input').fill('zzznomatch');

    await expect(app.page.getByTestId('note-list-empty')).toBeVisible();
  });

  test('search filters trashed notes by content preview', async ({ app }) => {
    await seedTrashedNotes(app, [
      { title: 'Trash Content A', content: 'unique content word' },
      { title: 'Trash Content B', content: 'different stuff here' },
    ]);
    await app.goto();
    await app.navTrash.click();

    await app.page.getByTestId('note-search-input').fill('unique');

    await expect(
      app.page.getByTestId('note-item').filter({ hasText: 'Trash Content A' }),
    ).toBeVisible();
    await expect(
      app.page.getByTestId('note-item').filter({ hasText: 'Trash Content B' }),
    ).not.toBeVisible();
  });

  test('search text entered in All Notes view persists when switching to trash', async ({
    app,
  }) => {
    await seedTrashedNotes(app, [{ title: 'Persist Search Trash Note' }]);
    await app.goto();

    // Type in All Notes view
    await app.page.getByTestId('note-search-input').fill('Persist');

    // Switch to trash — search text is local state and stays
    await app.navTrash.click();

    await expect(app.page.getByTestId('note-search-input')).toHaveValue('Persist');
  });
});
