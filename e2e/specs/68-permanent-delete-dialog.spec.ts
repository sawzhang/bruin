/**
 * Permanent delete confirm dialog tests: dialog title, message content
 * (includes note title + "cannot be undone"), confirm removes note, cancel keeps it.
 * Triggered by clicking the "Delete" hover button on a trash item.
 * Complements spec 27 (cancel flow) which tests cancel but not dialog content.
 */
import { test, expect } from '../fixtures';

async function trashAndOpenDelete(
  app: import('../page-objects/AppPage').AppPage,
  title: string,
) {
  await app.openNoteContextMenu(title);
  await app.clickContextMenuItem('Move to Trash');
  await app.navTrash.click();
  await app.page
    .getByTestId('note-item')
    .filter({ hasText: title })
    .getByTitle('Delete permanently')
    .click({ force: true });
}

test.describe('Permanent Delete Dialog', () => {
  test('permanent delete dialog has title "Delete Permanently?"', async ({ app }) => {
    await app.seed([{ title: 'Perm Delete Title Test' }]);
    await app.goto();

    await trashAndOpenDelete(app, 'Perm Delete Title Test');

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('Delete Permanently?');
  });

  test('permanent delete dialog message includes the note title', async ({ app }) => {
    await app.seed([{ title: 'My Precious Note' }]);
    await app.goto();

    await trashAndOpenDelete(app, 'My Precious Note');

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('My Precious Note');
  });

  test('permanent delete dialog message says "cannot be undone"', async ({ app }) => {
    await app.seed([{ title: 'Undone Warning Note' }]);
    await app.goto();

    await trashAndOpenDelete(app, 'Undone Warning Note');

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('cannot be undone');
  });

  test('permanent delete dialog message says "permanently deleted"', async ({ app }) => {
    await app.seed([{ title: 'Perm Deleted Note' }]);
    await app.goto();

    await trashAndOpenDelete(app, 'Perm Deleted Note');

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('permanently deleted');
  });

  test('confirming permanent delete removes note from trash', async ({ app }) => {
    await app.seed([{ title: 'Gone For Good' }]);
    await app.goto();

    await trashAndOpenDelete(app, 'Gone For Good');
    await app.confirmDialog();

    await expect(
      app.page.getByTestId('note-item').filter({ hasText: 'Gone For Good' }),
    ).not.toBeVisible();
  });

  test('after permanent delete, trash is empty and shows empty state', async ({ app }) => {
    await app.seed([{ title: 'Last Perm Delete Note' }]);
    await app.goto();

    await trashAndOpenDelete(app, 'Last Perm Delete Note');
    await app.confirmDialog();

    await expect(app.noteListEmpty).toBeVisible();
  });

  test('cancelling permanent delete keeps note in trash', async ({ app }) => {
    await app.seed([{ title: 'Cancel Perm Note' }]);
    await app.goto();

    await trashAndOpenDelete(app, 'Cancel Perm Note');
    await app.cancelDialog();

    await expect(
      app.page.getByTestId('note-item').filter({ hasText: 'Cancel Perm Note' }),
    ).toBeVisible();
  });

  test('confirm dialog label button says "Delete"', async ({ app }) => {
    await app.seed([{ title: 'Confirm Label Note' }]);
    await app.goto();

    await trashAndOpenDelete(app, 'Confirm Label Note');

    // The confirm button (danger variant) should say "Delete"
    await expect(
      app.page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete' }),
    ).toBeVisible();
  });
});
