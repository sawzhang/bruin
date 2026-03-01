/**
 * Toast CSS class and icon text tests: success/error/info toast CSS colour
 * classes (text-green-400, text-red-400, text-blue-400) and icon characters
 * (✓, ✗, ℹ) are never asserted in spec 24 (which only tests visibility,
 * dismiss, and data-toast-type attribute).
 */
import { test, expect } from '../fixtures';

/** Trigger a success toast by restoring a trashed note. */
async function triggerSuccessToast(app: import('../page-objects/AppPage').AppPage) {
  await app.seed([{ title: 'Toast Success Note' }]);
  await app.goto();
  await app.openNoteContextMenu('Toast Success Note');
  await app.clickContextMenuItem('Move to Trash');
  await app.navTrash.click();
  await app.page.getByTestId('note-item').filter({ hasText: 'Toast Success Note' }).click();
  await app.page.getByTestId('btn-restore').click();
}

/** Trigger a success toast by trashing a note (same type, different message). */
async function triggerTrashToast(app: import('../page-objects/AppPage').AppPage) {
  await app.seed([{ title: 'Toast Trash Note' }]);
  await app.goto();
  await app.noteItem('Toast Trash Note').click();
  await app.page.getByTestId('btn-more').click();
  await app.page.getByText('Move to Trash').click();
  await app.confirmDialog();
}

test.describe('Toast CSS and Icons', () => {
  test('success toast has text-green-400 CSS class', async ({ app }) => {
    await triggerSuccessToast(app);

    const toast = app.page.getByTestId('toast').filter({ hasText: 'Note restored' });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/text-green-400/);
  });

  test('success toast contains ✓ icon', async ({ app }) => {
    await triggerSuccessToast(app);

    const toast = app.page.getByTestId('toast').filter({ hasText: 'Note restored' });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('✓');
  });

  test('success toast (trash) has text-green-400 CSS class', async ({ app }) => {
    await triggerTrashToast(app);

    const toast = app.page.getByTestId('toast').filter({ hasText: 'Note moved to trash' });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/text-green-400/);
  });

  test('success toast (trash) contains ✓ icon', async ({ app }) => {
    await triggerTrashToast(app);

    const toast = app.page.getByTestId('toast').filter({ hasText: 'Note moved to trash' });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('✓');
  });

  test('webhook success toast has text-green-400 CSS class', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-toast-css',
        url: 'https://toast-css.example.com/hook',
        event_types: [],
        secret: 'secret',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    });
    await app.goto();
    await app.btnSettings.click();
    await app.page.getByTestId('btn-manage-webhooks').click();

    const webhookItem = app.page.getByTestId('webhook-item').filter({ hasText: 'toast-css.example.com' });
    await webhookItem.getByRole('button', { name: 'Test' }).click();

    const toast = app.page.getByTestId('toast').filter({ hasText: /Webhook test succeeded/ });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/text-green-400/);
  });
});
