/**
 * Trash panel tests: view, restore, permanent delete, empty trash
 */
import { test, expect } from '../fixtures';

test.describe('Trash', () => {
  test('nav-trash button is visible in sidebar', async ({ app }) => {
    await app.goto();

    await expect(app.navTrash).toBeVisible();
  });

  test('clicking nav-trash opens trash view with empty state', async ({ app }) => {
    await app.goto();
    await app.navTrash.click();

    await expect(app.noteListEmpty).toBeVisible();
  });

  test('trashed notes appear in trash view', async ({ app }) => {
    await app.seed([
      { title: 'Note to Delete' },
    ]);
    await app.goto();

    // Trash the note via context menu
    await app.openNoteContextMenu('Note to Delete');
    await app.clickContextMenuItem('Move to Trash');

    // Switch to trash view
    await app.navTrash.click();

    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Note to Delete' })).toBeVisible();
  });

  test('trashed notes are hidden from the main note list', async ({ app }) => {
    await app.seed([
      { title: 'Will Be Trashed' },
      { title: 'Stays Here' },
    ]);
    await app.goto();

    await app.openNoteContextMenu('Will Be Trashed');
    await app.clickContextMenuItem('Move to Trash');

    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Stays Here' })).toBeVisible();
    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Will Be Trashed' })).not.toBeVisible();
  });

  test('restoring a note from trash returns it to the note list', async ({ app }) => {
    await app.seed([
      { title: 'To Restore' },
    ]);
    await app.goto();

    // Trash it
    await app.openNoteContextMenu('To Restore');
    await app.clickContextMenuItem('Move to Trash');

    // Go to trash and restore (force-click the hidden button)
    await app.navTrash.click();
    const trashItem = app.page.getByTestId('note-item').filter({ hasText: 'To Restore' });
    await trashItem.getByTitle('Restore note').click({ force: true });

    // Back in all-notes view it should be visible
    await app.navAllNotes.click();
    await expect(app.page.getByTestId('note-item').filter({ hasText: 'To Restore' })).toBeVisible();
  });

  test('permanently deleting a note removes it from trash', async ({ app }) => {
    await app.seed([
      { title: 'Permanent Delete' },
    ]);
    await app.goto();

    await app.openNoteContextMenu('Permanent Delete');
    await app.clickContextMenuItem('Move to Trash');

    await app.navTrash.click();
    const trashItem = app.page.getByTestId('note-item').filter({ hasText: 'Permanent Delete' });
    await trashItem.getByTitle('Delete permanently').click({ force: true });
    await app.confirmDialog();

    await expect(app.noteListEmpty).toBeVisible();
  });

  test('empty trash removes all trashed notes', async ({ app }) => {
    await app.seed([
      { title: 'Trash One' },
      { title: 'Trash Two' },
    ]);
    await app.goto();

    // Trash both notes
    await app.openNoteContextMenu('Trash One');
    await app.clickContextMenuItem('Move to Trash');
    await app.openNoteContextMenu('Trash Two');
    await app.clickContextMenuItem('Move to Trash');

    await app.navTrash.click();
    await app.page.getByRole('button', { name: 'Empty Trash' }).click();
    await app.confirmDialog();

    await expect(app.noteListEmpty).toBeVisible();
  });
});
