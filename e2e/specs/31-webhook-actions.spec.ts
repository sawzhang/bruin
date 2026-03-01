/**
 * Webhook action tests: delete, test (toast), disable/enable toggle
 */
import { test, expect } from '../fixtures';

test.describe('Webhook Actions', () => {
  // Helper: open webhook manager with a pre-seeded webhook
  async function openWithSeededWebhook(app: import('../page-objects/AppPage').AppPage, url: string) {
    await app.page.addInitScript((webhookUrl: string) => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-action-test',
        url: webhookUrl,
        event_types: [],
        secret: 'secret',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    }, url);
    await app.goto();
    await app.btnSettings.click();
    await app.page.getByTestId('btn-manage-webhooks').click();
  }

  test('deleting a webhook removes it from the list', async ({ app }) => {
    await openWithSeededWebhook(app, 'https://delete-me.example.com/hook');

    const webhookItem = app.page.getByTestId('webhook-item').filter({ hasText: 'delete-me.example.com' });
    await webhookItem.getByRole('button', { name: 'Delete' }).click();

    await expect(webhookItem).not.toBeVisible();
    await expect(app.page.getByTestId('webhook-empty')).toBeVisible();
  });

  test('testing a webhook shows a success toast', async ({ app }) => {
    await openWithSeededWebhook(app, 'https://test-me.example.com/hook');

    const webhookItem = app.page.getByTestId('webhook-item').filter({ hasText: 'test-me.example.com' });
    await webhookItem.getByRole('button', { name: 'Test' }).click();

    await expect(
      app.page.getByTestId('toast').filter({ hasText: /Webhook test succeeded/ })
    ).toBeVisible();
  });

  test('disabling a webhook changes its button to Enable', async ({ app }) => {
    await openWithSeededWebhook(app, 'https://disable-me.example.com/hook');

    const webhookItem = app.page.getByTestId('webhook-item').filter({ hasText: 'disable-me.example.com' });
    await webhookItem.getByRole('button', { name: 'Disable' }).click();

    await expect(webhookItem.getByRole('button', { name: 'Enable' })).toBeVisible();
    await expect(webhookItem.getByRole('button', { name: 'Disable' })).not.toBeVisible();
  });

  test('enabling a disabled webhook changes its button back to Disable', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-inactive',
        url: 'https://enable-me.example.com/hook',
        event_types: [],
        secret: 'secret',
        is_active: false,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    });
    await app.goto();
    await app.btnSettings.click();
    await app.page.getByTestId('btn-manage-webhooks').click();

    const webhookItem = app.page.getByTestId('webhook-item').filter({ hasText: 'enable-me.example.com' });
    await webhookItem.getByRole('button', { name: 'Enable' }).click();

    await expect(webhookItem.getByRole('button', { name: 'Disable' })).toBeVisible();
  });
});
