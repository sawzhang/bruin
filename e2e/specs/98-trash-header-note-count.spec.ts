/**
 * Trash header note count text tests: the NoteList trash view shows "N note(s) in trash"
 * text in the header. Singular/plural form and visibility are never asserted in spec 17
 * (basic trash CRUD) or spec 59 (trash view extras) — they only test the "Empty Trash"
 * button visibility and note-item counts.
 */
import { test, expect } from '../fixtures';

async function seedDeletedNotes(
  app: import('../page-objects/AppPage').AppPage,
  titles: string[],
) {
  await app.page.addInitScript((titleList: string[]) => {
    const now = new Date().toISOString();
    titleList.forEach((title, i) => {
      window.__TAURI_MOCK_DB__.notes.push({
        id: `trash-count-${i}`,
        title,
        content: '',
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
  }, titles);
}

test.describe('Trash Header Note Count', () => {
  test('trash header shows "1 note in trash" (singular) with one trashed note', async ({ app }) => {
    await seedDeletedNotes(app, ['Only Trashed Note']);
    await app.goto();
    await app.navTrash.click();

    await expect(app.page.getByTestId('note-list-panel')).toContainText('1 note in trash');
  });

  test('trash header does NOT show "1 notes in trash" (no incorrect plural)', async ({ app }) => {
    await seedDeletedNotes(app, ['Singular Check Note']);
    await app.goto();
    await app.navTrash.click();

    await expect(app.page.getByTestId('note-list-panel')).not.toContainText('1 notes in trash');
  });

  test('trash header shows "2 notes in trash" (plural) with two trashed notes', async ({ app }) => {
    await seedDeletedNotes(app, ['Trash Count A', 'Trash Count B']);
    await app.goto();
    await app.navTrash.click();

    await expect(app.page.getByTestId('note-list-panel')).toContainText('2 notes in trash');
  });

  test('trash header shows "3 notes in trash" with three trashed notes', async ({ app }) => {
    await seedDeletedNotes(app, ['Trash One', 'Trash Two', 'Trash Three']);
    await app.goto();
    await app.navTrash.click();

    await expect(app.page.getByTestId('note-list-panel')).toContainText('3 notes in trash');
  });

  test('trash header count is not visible when trash is empty', async ({ app }) => {
    await app.goto();
    await app.navTrash.click();

    await expect(app.page.getByTestId('note-list-panel')).not.toContainText('in trash');
  });

  test('Empty Trash confirm dialog mentions the note count', async ({ app }) => {
    await seedDeletedNotes(app, ['Count Dialog A', 'Count Dialog B']);
    await app.goto();
    await app.navTrash.click();

    await app.page.getByRole('button', { name: 'Empty Trash' }).click();

    // The confirm dialog message says "All 2 notes in trash will be permanently deleted."
    await expect(app.page.getByTestId('confirm-dialog')).toContainText('2 note');
  });

  test('note-list-panel is visible in trash view', async ({ app }) => {
    await app.goto();
    await app.navTrash.click();

    await expect(app.page.getByTestId('note-list-panel')).toBeVisible();
  });
});
