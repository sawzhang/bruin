/**
 * ConfirmDialog cancel tests: cancelling destructive dialogs leaves state unchanged
 */
import { test, expect } from '../fixtures';

test.describe('Confirm Cancel', () => {
  test('cancelling trash confirmation via editor keeps note in main list', async ({ app }) => {
    await app.seed([{ title: 'Cancel Trash Note' }]);
    await app.goto();
    await app.noteItem('Cancel Trash Note').click();

    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Move to Trash').click();

    // Dialog appears — click Cancel
    await expect(app.page.getByTestId('confirm-dialog')).toBeVisible();
    await app.cancelDialog();

    // Note should still be in the main list
    await expect(app.noteItem('Cancel Trash Note')).toBeVisible();
  });

  test('Escape key cancels the trash confirmation dialog', async ({ app }) => {
    await app.seed([{ title: 'Escape Cancel Note' }]);
    await app.goto();
    await app.noteItem('Escape Cancel Note').click();

    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Move to Trash').click();
    await expect(app.page.getByTestId('confirm-dialog')).toBeVisible();

    await app.page.keyboard.press('Escape');

    await expect(app.page.getByTestId('confirm-dialog')).not.toBeVisible();
    await expect(app.noteItem('Escape Cancel Note')).toBeVisible();
  });

  test('cancelling permanent delete keeps note in trash', async ({ app }) => {
    await app.seed([{ title: 'Cancel Perm Delete' }]);
    await app.goto();

    // Trash the note first
    await app.openNoteContextMenu('Cancel Perm Delete');
    await app.clickContextMenuItem('Move to Trash');

    // Open trash
    await app.navTrash.click();
    const trashItem = app.page.getByTestId('note-item').filter({ hasText: 'Cancel Perm Delete' });
    await expect(trashItem).toBeVisible();

    // Click "Delete permanently" button (hover to reveal, force click)
    await trashItem.getByTitle('Delete permanently').click({ force: true });

    // Dialog appears — click Cancel
    await expect(app.page.getByTestId('confirm-dialog')).toBeVisible();
    await app.cancelDialog();

    // Note should still be in trash
    await expect(trashItem).toBeVisible();
  });

  test('cancelling empty trash leaves all notes in trash', async ({ app }) => {
    await app.seed([
      { title: 'Empty Trash A' },
      { title: 'Empty Trash B' },
    ]);
    await app.goto();

    // Trash both notes
    await app.openNoteContextMenu('Empty Trash A');
    await app.clickContextMenuItem('Move to Trash');
    await app.openNoteContextMenu('Empty Trash B');
    await app.clickContextMenuItem('Move to Trash');

    // Open trash
    await app.navTrash.click();
    await expect(app.page.getByTestId('note-item')).toHaveCount(2);

    // Click "Empty Trash" button — dialog appears
    await app.page.getByRole('button', { name: 'Empty Trash', exact: true }).click();
    await expect(app.page.getByTestId('confirm-dialog')).toBeVisible();

    // Cancel — notes should remain
    await app.cancelDialog();

    await expect(app.page.getByTestId('note-item')).toHaveCount(2);
  });
});
