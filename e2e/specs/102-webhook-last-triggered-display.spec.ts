/**
 * Webhook item "Last: X ago" display tests: when last_triggered_at is a
 * non-null ISO timestamp the webhook item shows a relative-time string
 * "Last: <distance> ago" (via date-fns formatDistanceToNow). Every prior
 * spec seeds webhooks with last_triggered_at: null so this text has never
 * been tested. Complements spec 53 (webhook item display).
 */
import { test, expect } from '../fixtures';

async function openWebhookManager(app: import('../page-objects/AppPage').AppPage) {
  await app.goto();
  await app.btnSettings.click();
  await app.page.getByTestId('btn-manage-webhooks').click();
  await expect(app.page.getByTestId('webhook-manager')).toBeVisible();
}

test.describe('Webhook Last Triggered Display', () => {
  test('webhook item shows "Last:" text when last_triggered_at is non-null', async ({ app }) => {
    await app.page.addInitScript(() => {
      // Use a timestamp 5 minutes ago so formatDistanceToNow renders a stable string
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-triggered',
        url: 'https://triggered.example.com/hook',
        event_types: [],
        secret: 'secret',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: fiveMinAgo,
        failure_count: 0,
      });
    });
    await openWebhookManager(app);

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'triggered.example.com' });
    await expect(item).toContainText('Last:');
  });

  test('webhook item shows relative time "ago" in Last: text', async ({ app }) => {
    await app.page.addInitScript(() => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-relative',
        url: 'https://relative.example.com/hook',
        event_types: [],
        secret: 'secret',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: tenMinAgo,
        failure_count: 0,
      });
    });
    await openWebhookManager(app);

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'relative.example.com' });
    // formatDistanceToNow always includes "ago" when addSuffix: true
    await expect(item).toContainText('ago');
  });

  test('webhook item does NOT show "Last:" when last_triggered_at is null', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-never-triggered',
        url: 'https://never.example.com/hook',
        event_types: [],
        secret: 'secret',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    });
    await openWebhookManager(app);

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'never.example.com' });
    await expect(item).not.toContainText('Last:');
  });

  test('two webhooks: only the triggered one shows "Last:"', async ({ app }) => {
    await app.page.addInitScript(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      window.__TAURI_MOCK_DB__.webhooks.push(
        {
          id: 'wh-has-trigger',
          url: 'https://has-trigger.example.com/hook',
          event_types: [],
          secret: 'sec',
          is_active: true,
          created_at: new Date().toISOString(),
          last_triggered_at: oneHourAgo,
          failure_count: 0,
        },
        {
          id: 'wh-no-trigger',
          url: 'https://no-trigger.example.com/hook',
          event_types: [],
          secret: 'sec',
          is_active: true,
          created_at: new Date().toISOString(),
          last_triggered_at: null,
          failure_count: 0,
        },
      );
    });
    await openWebhookManager(app);

    const triggered = app.page
      .getByTestId('webhook-item')
      .filter({ hasText: 'has-trigger.example.com' });
    const notTriggered = app.page
      .getByTestId('webhook-item')
      .filter({ hasText: 'no-trigger.example.com' });

    await expect(triggered).toContainText('Last:');
    await expect(notTriggered).not.toContainText('Last:');
  });

  test('"Last:" text and "Failures:" text can appear together in one item', async ({ app }) => {
    await app.page.addInitScript(() => {
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-both',
        url: 'https://both-fields.example.com/hook',
        event_types: [],
        secret: 'secret',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: twoMinAgo,
        failure_count: 2,
      });
    });
    await openWebhookManager(app);

    const item = app.page
      .getByTestId('webhook-item')
      .filter({ hasText: 'both-fields.example.com' });
    await expect(item).toContainText('Last:');
    await expect(item).toContainText('Failures: 2');
  });
});
