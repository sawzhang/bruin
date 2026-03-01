/**
 * Toast border colour class tests: TOAST_STYLES in Toast.tsx sets both a text
 * colour and a border colour on each toast — e.g. success gets both
 * "text-green-400" AND "border-green-500/50". Spec 95 asserts only the
 * text-* classes; the border-* classes have never been tested.
 * Complements spec 95 (toast CSS and icons) and spec 24 (toast visibility).
 */
import { test, expect } from '../fixtures';

/** Trigger a success toast by restoring a trashed note. */
async function triggerSuccessToast(app: import('../page-objects/AppPage').AppPage) {
  await app.seed([{ title: 'Border Success Note' }]);
  await app.goto();
  await app.openNoteContextMenu('Border Success Note');
  await app.clickContextMenuItem('Move to Trash');
  await app.navTrash.click();
  await app.page.getByTestId('note-item').filter({ hasText: 'Border Success Note' }).click();
  await app.page.getByTestId('btn-restore').click();
}

test.describe('Toast Border Color', () => {
  test('success toast has border-green-500/50 class', async ({ app }) => {
    await triggerSuccessToast(app);

    const toast = app.page.getByTestId('toast').filter({ hasText: 'Note restored' });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/border-green-500\/50/);
  });

  test('success toast has both text-green-400 and border-green-500/50 simultaneously', async ({
    app,
  }) => {
    await triggerSuccessToast(app);

    const toast = app.page.getByTestId('toast').filter({ hasText: 'Note restored' });
    await expect(toast).toHaveClass(/text-green-400/);
    await expect(toast).toHaveClass(/border-green-500\/50/);
  });

  test('success toast triggered by trash action has border-green-500/50 class', async ({ app }) => {
    await app.seed([{ title: 'Border Trash Note' }]);
    await app.goto();
    await app.noteItem('Border Trash Note').click();
    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Move to Trash').click();
    await app.confirmDialog();

    const toast = app.page.getByTestId('toast').filter({ hasText: 'Note moved to trash' });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/border-green-500\/50/);
  });

  test('toast has animate-slide-in-right class', async ({ app }) => {
    await triggerSuccessToast(app);

    const toast = app.page.getByTestId('toast').filter({ hasText: 'Note restored' });
    await expect(toast).toHaveClass(/animate-slide-in-right/);
  });

  test('toast has bg-bear-sidebar class', async ({ app }) => {
    await triggerSuccessToast(app);

    const toast = app.page.getByTestId('toast').filter({ hasText: 'Note restored' });
    await expect(toast).toHaveClass(/bg-bear-sidebar/);
  });

  test('webhook success toast has border-green-500/50 class', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-border-toast',
        url: 'https://border-toast.example.com/hook',
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

    const webhookItem = app.page
      .getByTestId('webhook-item')
      .filter({ hasText: 'border-toast.example.com' });
    await webhookItem.getByRole('button', { name: 'Test' }).click();

    const toast = app.page.getByTestId('toast').filter({ hasText: /Webhook test succeeded/ });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/border-green-500\/50/);
  });
});
