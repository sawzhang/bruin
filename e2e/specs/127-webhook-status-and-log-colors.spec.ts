/**
 * Webhook status indicator and log delivery indicator colour tests:
 * - WebhookManager.tsx line 136: active webhook gets a "bg-green-500" dot;
 *   inactive gets "bg-gray-400". Specs 22/31/53 never call toHaveClass() on this.
 * - WebhookLogViewer.tsx line 24: successful delivery gets "bg-green-500";
 *   failed delivery gets "bg-red-500". Spec 56 only tests empty-state and
 *   navigation — it never seeds logs (get_webhook_logs always returned []).
 *   The mock now supports seeding via window.__TAURI_MOCK_DB__.webhookLogs.
 * Complements spec 22 (webhooks), spec 53 (webhook item display), spec 56 (log viewer).
 */
import { test, expect } from '../fixtures';

async function openWebhookManager(app: import('../page-objects/AppPage').AppPage) {
  await app.goto();
  await app.btnSettings.click();
  await app.page.getByTestId('btn-manage-webhooks').click();
  await expect(app.page.getByTestId('webhook-manager')).toBeVisible();
}

test.describe('Webhook Status and Log Colors', () => {
  // ── Status dot ──────────────────────────────────────────────────────────────

  test('active webhook item has bg-green-500 status dot', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-active-dot',
        url: 'https://active-dot.example.com/hook',
        event_types: [],
        secret: 'sec',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    });
    await openWebhookManager(app);

    const item = app.page
      .getByTestId('webhook-item')
      .filter({ hasText: 'active-dot.example.com' });
    await expect(item.locator('span.bg-green-500')).toBeVisible();
  });

  test('inactive webhook item has bg-gray-400 status dot', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-inactive-dot',
        url: 'https://inactive-dot.example.com/hook',
        event_types: [],
        secret: 'sec',
        is_active: false,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    });
    await openWebhookManager(app);

    const item = app.page
      .getByTestId('webhook-item')
      .filter({ hasText: 'inactive-dot.example.com' });
    await expect(item.locator('span.bg-gray-400')).toBeVisible();
  });

  test('active webhook does not have bg-gray-400 dot', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-no-gray',
        url: 'https://no-gray.example.com/hook',
        event_types: [],
        secret: 'sec',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    });
    await openWebhookManager(app);

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'no-gray.example.com' });
    await expect(item.locator('span.bg-gray-400')).not.toBeVisible();
  });

  test('inactive webhook does not have bg-green-500 dot', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-no-green',
        url: 'https://no-green.example.com/hook',
        event_types: [],
        secret: 'sec',
        is_active: false,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    });
    await openWebhookManager(app);

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'no-green.example.com' });
    await expect(item.locator('span.bg-green-500')).not.toBeVisible();
  });

  // ── Log delivery indicator ───────────────────────────────────────────────────

  test('successful log entry has bg-green-500 indicator', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-log-green',
        url: 'https://log-green.example.com/hook',
        event_types: [],
        secret: 'sec',
        is_active: true,
        created_at: now,
        last_triggered_at: now,
        failure_count: 0,
      });
      window.__TAURI_MOCK_DB__.webhookLogs.push({
        id: 'log-success-1',
        webhook_id: 'wh-log-green',
        success: true,
        event_type: 'note_created',
        status_code: 200,
        timestamp: now,
        payload: '{}',
        response_body: 'OK',
        error_message: null,
        attempt: 1,
      });
    });
    await openWebhookManager(app);

    await app.page
      .getByTestId('webhook-item')
      .filter({ hasText: 'log-green.example.com' })
      .getByRole('button', { name: 'Logs' })
      .click();

    // The green dot next to the log entry
    await expect(app.page.locator('span.bg-green-500').last()).toBeVisible();
  });

  test('failed log entry has bg-red-500 indicator', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-log-red',
        url: 'https://log-red.example.com/hook',
        event_types: [],
        secret: 'sec',
        is_active: true,
        created_at: now,
        last_triggered_at: now,
        failure_count: 1,
      });
      window.__TAURI_MOCK_DB__.webhookLogs.push({
        id: 'log-fail-1',
        webhook_id: 'wh-log-red',
        success: false,
        event_type: 'note_updated',
        status_code: 500,
        timestamp: now,
        payload: '{}',
        response_body: null,
        error_message: 'Connection refused',
        attempt: 1,
      });
    });
    await openWebhookManager(app);

    await app.page
      .getByTestId('webhook-item')
      .filter({ hasText: 'log-red.example.com' })
      .getByRole('button', { name: 'Logs' })
      .click();

    await expect(app.page.locator('span.bg-red-500')).toBeVisible();
  });
});
