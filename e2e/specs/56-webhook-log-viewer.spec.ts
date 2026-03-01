/**
 * Webhook log viewer tests: opening via "Logs" button, empty state,
 * heading, "← Back to list" navigation.
 * Note: the mock's get_webhook_logs always returns [] so only empty-state
 * UI paths are testable without backend logs.
 */
import { test, expect } from '../fixtures';

async function openWebhookManagerWithSeededWebhook(
  app: import('../page-objects/AppPage').AppPage,
  id: string,
  url: string,
) {
  await app.page.addInitScript((args: { id: string; url: string }) => {
    window.__TAURI_MOCK_DB__.webhooks.push({
      id: args.id,
      url: args.url,
      event_types: [],
      secret: 'secret',
      is_active: true,
      created_at: new Date().toISOString(),
      last_triggered_at: null,
      failure_count: 0,
    });
  }, { id, url });
  await app.goto();
  await app.btnSettings.click();
  await app.page.getByTestId('btn-manage-webhooks').click();
  await expect(app.page.getByTestId('webhook-manager')).toBeVisible();
}

test.describe('Webhook Log Viewer', () => {
  test('clicking "Logs" on a webhook item opens the log viewer', async ({ app }) => {
    await openWebhookManagerWithSeededWebhook(app, 'wh-log-open', 'https://log-open.example.com/hook');

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'log-open.example.com' });
    await item.getByRole('button', { name: 'Logs' }).click();

    // Log viewer shows "Delivery Logs" heading
    await expect(app.page.getByRole('heading', { name: 'Delivery Logs' })).toBeVisible();
  });

  test('log viewer shows "Delivery Logs" heading', async ({ app }) => {
    await openWebhookManagerWithSeededWebhook(app, 'wh-log-hdr', 'https://log-hdr.example.com/hook');

    await app.page.getByTestId('webhook-item')
      .filter({ hasText: 'log-hdr.example.com' })
      .getByRole('button', { name: 'Logs' })
      .click();

    await expect(app.page.getByRole('heading', { name: 'Delivery Logs' })).toBeVisible();
  });

  test('log viewer shows empty state when no logs exist', async ({ app }) => {
    await openWebhookManagerWithSeededWebhook(app, 'wh-log-empty', 'https://log-empty.example.com/hook');

    await app.page.getByTestId('webhook-item')
      .filter({ hasText: 'log-empty.example.com' })
      .getByRole('button', { name: 'Logs' })
      .click();

    await expect(app.page.getByText('No delivery logs yet')).toBeVisible();
  });

  test('"← Back to list" button is visible in the log viewer', async ({ app }) => {
    await openWebhookManagerWithSeededWebhook(app, 'wh-log-back', 'https://log-back.example.com/hook');

    await app.page.getByTestId('webhook-item')
      .filter({ hasText: 'log-back.example.com' })
      .getByRole('button', { name: 'Logs' })
      .click();

    await expect(app.page.getByRole('button', { name: /Back to list/i })).toBeVisible();
  });

  test('clicking "← Back to list" returns to the webhook list', async ({ app }) => {
    await openWebhookManagerWithSeededWebhook(app, 'wh-log-nav', 'https://log-nav.example.com/hook');

    await app.page.getByTestId('webhook-item')
      .filter({ hasText: 'log-nav.example.com' })
      .getByRole('button', { name: 'Logs' })
      .click();

    await expect(app.page.getByRole('heading', { name: 'Delivery Logs' })).toBeVisible();

    await app.page.getByRole('button', { name: /Back to list/i }).click();

    // Webhook list is visible again
    await expect(app.page.getByTestId('webhook-item').filter({ hasText: 'log-nav.example.com' })).toBeVisible();
    await expect(app.page.getByRole('heading', { name: 'Delivery Logs' })).not.toBeVisible();
  });

  test('webhook manager × button closes the manager from within the log viewer', async ({ app }) => {
    await openWebhookManagerWithSeededWebhook(app, 'wh-log-close', 'https://log-close.example.com/hook');

    await app.page.getByTestId('webhook-item')
      .filter({ hasText: 'log-close.example.com' })
      .getByRole('button', { name: 'Logs' })
      .click();

    // Click the × close button in the manager header
    await app.page.getByTestId('webhook-manager').getByRole('button', { name: '×' }).click();

    await expect(app.page.getByTestId('webhook-manager')).not.toBeVisible();
  });

  test('webhook list is restored after navigating to logs and back', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.webhooks.push(
        { id: 'wh-restore-a', url: 'https://restore-a.example.com/hook', event_types: [], secret: 'sec', is_active: true, created_at: now, last_triggered_at: null, failure_count: 0 },
        { id: 'wh-restore-b', url: 'https://restore-b.example.com/hook', event_types: [], secret: 'sec', is_active: true, created_at: now, last_triggered_at: null, failure_count: 0 },
      );
    });
    await app.goto();
    await app.btnSettings.click();
    await app.page.getByTestId('btn-manage-webhooks').click();

    // View logs for first webhook
    await app.page.getByTestId('webhook-item')
      .filter({ hasText: 'restore-a.example.com' })
      .getByRole('button', { name: 'Logs' })
      .click();

    // Go back
    await app.page.getByRole('button', { name: /Back to list/i }).click();

    // Both webhooks visible again
    await expect(app.page.getByTestId('webhook-item').filter({ hasText: 'restore-a.example.com' })).toBeVisible();
    await expect(app.page.getByTestId('webhook-item').filter({ hasText: 'restore-b.example.com' })).toBeVisible();
  });
});
