/**
 * Toast notification tests: appearance, types, and dismissal
 */
import { test, expect } from '../fixtures';

test.describe('Toasts', () => {
  test('restoring a note from editor shows a success toast', async ({ app }) => {
    await app.seed([{ title: 'Toast Restore' }]);
    await app.goto();

    // Trash it
    await app.openNoteContextMenu('Toast Restore');
    await app.clickContextMenuItem('Move to Trash');

    // Open in trash, click restore
    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Toast Restore' }).click();
    await app.page.getByTestId('btn-restore').click();

    await expect(app.page.getByTestId('toast').filter({ hasText: 'Note restored' })).toBeVisible();
  });

  test('toast has a dismiss button', async ({ app }) => {
    await app.seed([{ title: 'Toast Dismiss' }]);
    await app.goto();

    await app.openNoteContextMenu('Toast Dismiss');
    await app.clickContextMenuItem('Move to Trash');
    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Toast Dismiss' }).click();
    await app.page.getByTestId('btn-restore').click();

    const toast = app.page.getByTestId('toast').filter({ hasText: 'Note restored' });
    await expect(toast).toBeVisible();
    await toast.getByRole('button').click();
    await expect(toast).not.toBeVisible();
  });

  test('trashing a note via editor more menu shows a toast', async ({ app }) => {
    await app.seed([{ title: 'Toast Trash' }]);
    await app.goto();
    await app.noteItem('Toast Trash').click();

    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Move to Trash').click();
    await app.confirmDialog();

    await expect(app.page.getByTestId('toast').filter({ hasText: 'Note moved to trash' })).toBeVisible();
  });

  test('toast data-toast-type reflects the notification type', async ({ app }) => {
    await app.seed([{ title: 'Toast Type' }]);
    await app.goto();

    await app.openNoteContextMenu('Toast Type');
    await app.clickContextMenuItem('Move to Trash');
    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Toast Type' }).click();
    await app.page.getByTestId('btn-restore').click();

    const toast = app.page.getByTestId('toast').filter({ hasText: 'Note restored' });
    await expect(toast).toHaveAttribute('data-toast-type', 'success');
  });
});
