/**
 * Trash view extra tests: seeded-deleted notes, "Empty Trash" button visibility,
 * individual restore from multiple trashed notes, and trash empty state after restore.
 * Complements spec 17 (basic trash CRUD) and 27 (cancel dialogs).
 */
import { test, expect } from '../fixtures';

test.describe('Trash View Extras', () => {
  test('note seeded with deleted:true appears in trash view without UI trashing', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.notes.push({
        id: 'pre-deleted-1',
        title: 'Pre-Deleted Note',
        content: 'Already in trash',
        state: 'draft',
        is_pinned: false,
        deleted: true,
        word_count: 3,
        tags: [],
        workspace_id: null,
        created_at: now,
        updated_at: now,
        version: 1,
      });
    });
    await app.goto();

    // Should not be in main list
    await expect(app.noteItem('Pre-Deleted Note')).not.toBeVisible();

    // Should appear in trash
    await app.navTrash.click();
    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Pre-Deleted Note' })).toBeVisible();
  });

  test('"Empty Trash" button is visible in trash header when notes exist', async ({ app }) => {
    await app.seed([{ title: 'Note to Empty' }]);
    await app.goto();

    await app.openNoteContextMenu('Note to Empty');
    await app.clickContextMenuItem('Move to Trash');

    await app.navTrash.click();

    await expect(app.page.getByRole('button', { name: 'Empty Trash', exact: true })).toBeVisible();
  });

  test('"Empty Trash" button is hidden when trash is empty', async ({ app }) => {
    await app.goto();
    await app.navTrash.click();

    await expect(app.page.getByRole('button', { name: 'Empty Trash', exact: true })).not.toBeVisible();
  });

  test('restoring one of two trashed notes leaves the other in trash', async ({ app }) => {
    await app.seed([
      { title: 'Trash Note A' },
      { title: 'Trash Note B' },
    ]);
    await app.goto();

    // Trash both
    await app.openNoteContextMenu('Trash Note A');
    await app.clickContextMenuItem('Move to Trash');
    await app.openNoteContextMenu('Trash Note B');
    await app.clickContextMenuItem('Move to Trash');

    await app.navTrash.click();
    await expect(app.page.getByTestId('note-item')).toHaveCount(2);

    // Restore only Note A via the hover restore button
    await app.page.getByTestId('note-item').filter({ hasText: 'Trash Note A' })
      .getByTitle('Restore note').click({ force: true });

    // Note B still in trash, Note A is gone from trash
    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Trash Note B' })).toBeVisible();
    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Trash Note A' })).not.toBeVisible();
  });

  test('restoring the last trashed note shows the trash empty state', async ({ app }) => {
    await app.seed([{ title: 'Last Trashed Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Last Trashed Note');
    await app.clickContextMenuItem('Move to Trash');

    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Last Trashed Note' })
      .getByTitle('Restore note').click({ force: true });

    await expect(app.noteListEmpty).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'Empty Trash', exact: true })).not.toBeVisible();
  });

  test('restored note is visible in All Notes after restoring from trash', async ({ app }) => {
    await app.seed([{ title: 'Restored From Trash' }]);
    await app.goto();

    await app.openNoteContextMenu('Restored From Trash');
    await app.clickContextMenuItem('Move to Trash');

    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Restored From Trash' })
      .getByTitle('Restore note').click({ force: true });

    await app.navAllNotes.click();
    await expect(app.noteItem('Restored From Trash')).toBeVisible();
  });

  test('multiple seeded-deleted notes all appear in trash', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      ['Deleted Alpha', 'Deleted Beta', 'Deleted Gamma'].forEach((title, i) => {
        window.__TAURI_MOCK_DB__.notes.push({
          id: 'pre-del-' + i,
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
    });
    await app.goto();
    await app.navTrash.click();

    await expect(app.page.getByTestId('note-item')).toHaveCount(3);
    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Deleted Alpha' })).toBeVisible();
    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Deleted Beta' })).toBeVisible();
    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Deleted Gamma' })).toBeVisible();
  });
});
