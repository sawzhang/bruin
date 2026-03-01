/**
 * ConfirmDialog detail tests: cancel-btn and confirm-btn testids, Escape key close,
 * backdrop click close, and variant="danger" red button styling.
 * Complements spec 08 (delete confirmation flow) and spec 27 (backdrop dismiss)
 * — neither tests the button testids directly or the danger variant styling.
 */
import { test, expect } from '../fixtures';

async function openMoveToTrashDialog(app: import('../page-objects/AppPage').AppPage) {
  await app.page.getByTestId('btn-more').click();
  await app.page.getByText('Move to Trash').click();
  await expect(app.page.getByTestId('confirm-dialog')).toBeVisible();
}

test.describe('ConfirmDialog Detail', () => {
  test('confirm-dialog has cancel-btn element', async ({ app }) => {
    await app.seed([{ title: 'Cancel Btn Note' }]);
    await app.goto();
    await app.noteItem('Cancel Btn Note').click();
    await openMoveToTrashDialog(app);

    await expect(app.page.getByTestId('cancel-btn')).toBeVisible();
  });

  test('confirm-dialog has confirm-btn element', async ({ app }) => {
    await app.seed([{ title: 'Confirm Btn Note' }]);
    await app.goto();
    await app.noteItem('Confirm Btn Note').click();
    await openMoveToTrashDialog(app);

    await expect(app.page.getByTestId('confirm-btn')).toBeVisible();
  });

  test('cancel-btn label is "Cancel"', async ({ app }) => {
    await app.seed([{ title: 'Cancel Label Note' }]);
    await app.goto();
    await app.noteItem('Cancel Label Note').click();
    await openMoveToTrashDialog(app);

    await expect(app.page.getByTestId('cancel-btn')).toHaveText('Cancel');
  });

  test('clicking cancel-btn closes the dialog', async ({ app }) => {
    await app.seed([{ title: 'Cancel Close Note' }]);
    await app.goto();
    await app.noteItem('Cancel Close Note').click();
    await openMoveToTrashDialog(app);

    await app.page.getByTestId('cancel-btn').click();

    await expect(app.page.getByTestId('confirm-dialog')).not.toBeVisible();
  });

  test('pressing Escape closes the confirm dialog', async ({ app }) => {
    await app.seed([{ title: 'Escape Close Note' }]);
    await app.goto();
    await app.noteItem('Escape Close Note').click();
    await openMoveToTrashDialog(app);

    await app.page.keyboard.press('Escape');

    await expect(app.page.getByTestId('confirm-dialog')).not.toBeVisible();
  });

  test('clicking the backdrop closes the confirm dialog', async ({ app }) => {
    await app.seed([{ title: 'Backdrop Close Note' }]);
    await app.goto();
    await app.noteItem('Backdrop Close Note').click();
    await openMoveToTrashDialog(app);

    // Click the backdrop overlay (top-left corner, outside the dialog box)
    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('confirm-dialog')).not.toBeVisible();
  });

  test('Move to Trash confirm-btn label is "Move to Trash"', async ({ app }) => {
    await app.seed([{ title: 'Confirm Label Note' }]);
    await app.goto();
    await app.noteItem('Confirm Label Note').click();
    await openMoveToTrashDialog(app);

    await expect(app.page.getByTestId('confirm-btn')).toHaveText('Move to Trash');
  });

  test('permanent-delete confirm-btn has bg-red-600 class (variant="danger")', async ({ app }) => {
    await app.seed([{ title: 'Danger Variant Note' }]);
    await app.goto();
    // Move to trash via context menu
    await app.openNoteContextMenu('Danger Variant Note');
    await app.clickContextMenuItem('Move to Trash');
    await app.confirmDialog();
    // Now in trash — open the note and click permanent delete
    await app.navTrash.click();
    await app.noteItem('Danger Variant Note').click();
    await app.page.getByTestId('btn-delete-permanent').click();

    await expect(app.page.getByTestId('confirm-btn')).toHaveClass(/bg-red-600/);
  });
});
