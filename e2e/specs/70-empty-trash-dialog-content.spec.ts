/**
 * "Empty Trash" confirm dialog content tests: title, confirm button label,
 * message text (singular/plural note count), and post-confirm empty state.
 * Complements spec 27 (cancel flow) which only tests that cancel preserves notes.
 */
import { test, expect } from '../fixtures';

async function openEmptyTrashDialog(
  app: import('../page-objects/AppPage').AppPage,
  titles: string[],
) {
  await app.seed(titles.map((title) => ({ title })));
  await app.goto();

  for (const title of titles) {
    await app.openNoteContextMenu(title);
    await app.clickContextMenuItem('Move to Trash');
  }

  await app.navTrash.click();
  await app.page.getByRole('button', { name: 'Empty Trash', exact: true }).click();
  await expect(app.page.getByTestId('confirm-dialog')).toBeVisible();
}

test.describe('Empty Trash Dialog Content', () => {
  test('Empty Trash dialog title is "Empty Trash?"', async ({ app }) => {
    await openEmptyTrashDialog(app, ['ET Title Note']);

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('Empty Trash?');
  });

  test('Empty Trash confirm button label is "Empty Trash"', async ({ app }) => {
    await openEmptyTrashDialog(app, ['ET Label Note']);

    await expect(
      app.page.getByTestId('confirm-dialog').getByRole('button', { name: 'Empty Trash' }),
    ).toBeVisible();
  });

  test('Empty Trash dialog message says "permanently deleted"', async ({ app }) => {
    await openEmptyTrashDialog(app, ['ET Perm Note']);

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('permanently deleted');
  });

  test('Empty Trash dialog message says "cannot be undone"', async ({ app }) => {
    await openEmptyTrashDialog(app, ['ET Undone Note']);

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('cannot be undone');
  });

  test('Empty Trash dialog message says "1 note" (singular) for one trashed note', async ({ app }) => {
    await openEmptyTrashDialog(app, ['ET Singular Note']);

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('1 note');
    await expect(app.page.getByTestId('confirm-dialog')).not.toContainText('1 notes');
  });

  test('Empty Trash dialog message says "2 notes" (plural) for two trashed notes', async ({ app }) => {
    await openEmptyTrashDialog(app, ['ET Plural A', 'ET Plural B']);

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('2 notes');
  });

  test('confirming Empty Trash removes all notes and shows empty state', async ({ app }) => {
    await openEmptyTrashDialog(app, ['ET Confirm A', 'ET Confirm B']);

    await app.confirmDialog();

    await expect(app.noteListEmpty).toBeVisible();
    await expect(app.page.getByTestId('note-item')).toHaveCount(0);
  });
});
