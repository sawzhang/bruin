/**
 * Webhook manager item display tests: active/inactive indicator dot,
 * event-type text, "All events" fallback, Logs button, form event-types
 * input, failure count display, and Cancel toggle.
 * Complements spec 22 (basic CRUD) and 31 (delete/test/toggle actions).
 */
import { test, expect } from '../fixtures';

async function openWebhookManager(app: import('../page-objects/AppPage').AppPage) {
  await app.goto();
  await app.btnSettings.click();
  await app.page.getByTestId('btn-manage-webhooks').click();
  await expect(app.page.getByTestId('webhook-manager')).toBeVisible();
}

test.describe('Webhook Item Display', () => {
  test('active webhook shows green indicator dot', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-active-dot',
        url: 'https://active.example.com/hook',
        event_types: [],
        secret: 'secret',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    });
    await openWebhookManager(app);

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'active.example.com' });
    await expect(item.locator('span.bg-green-500')).toBeVisible();
  });

  test('inactive webhook shows gray indicator dot', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-inactive-dot',
        url: 'https://inactive.example.com/hook',
        event_types: [],
        secret: 'secret',
        is_active: false,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    });
    await openWebhookManager(app);

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'inactive.example.com' });
    await expect(item.locator('span.bg-gray-400')).toBeVisible();
  });

  test('webhook with specific event_types shows those types in item', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-events',
        url: 'https://events.example.com/hook',
        event_types: ['note_created', 'note_updated'],
        secret: 'secret',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    });
    await openWebhookManager(app);

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'events.example.com' });
    await expect(item).toContainText('note_created');
    await expect(item).toContainText('note_updated');
  });

  test('webhook with no event_types shows "All events"', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-all-events',
        url: 'https://all-events.example.com/hook',
        event_types: [],
        secret: 'secret',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    });
    await openWebhookManager(app);

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'all-events.example.com' });
    await expect(item).toContainText('All events');
  });

  test('webhook item shows "Logs" button', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-logs-btn',
        url: 'https://logs.example.com/hook',
        event_types: [],
        secret: 'secret',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 0,
      });
    });
    await openWebhookManager(app);

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'logs.example.com' });
    await expect(item.getByRole('button', { name: 'Logs' })).toBeVisible();
  });

  test('form shows event types input with placeholder text', async ({ app }) => {
    await openWebhookManager(app);

    await app.page.getByTestId('webhook-add-toggle-btn').click();

    // Third input in the form — event types comma-separated input
    await expect(
      app.page.locator('input[placeholder="Event types (comma-separated, empty = all)"]')
    ).toBeVisible();
  });

  test('registering with event types shows those types in the webhook item', async ({ app }) => {
    await openWebhookManager(app);
    await app.page.getByTestId('webhook-add-toggle-btn').click();

    await app.page.getByTestId('webhook-url-input').fill('https://typed-events.example.com/hook');
    await app.page.getByTestId('webhook-secret-input').fill('my-secret');
    await app.page.locator('input[placeholder="Event types (comma-separated, empty = all)"]')
      .fill('note_created, note_trashed');
    await app.page.getByTestId('webhook-register-btn').click();

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'typed-events.example.com' });
    await expect(item).toContainText('note_created');
  });

  test('"Cancel" text appears on add-toggle-btn when form is visible', async ({ app }) => {
    await openWebhookManager(app);

    await app.page.getByTestId('webhook-add-toggle-btn').click();

    await expect(app.page.getByTestId('webhook-add-toggle-btn')).toHaveText('Cancel');
  });

  test('webhook with failure_count > 0 shows "Failures: N" in item', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-failures',
        url: 'https://failures.example.com/hook',
        event_types: [],
        secret: 'secret',
        is_active: true,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        failure_count: 3,
      });
    });
    await openWebhookManager(app);

    const item = app.page.getByTestId('webhook-item').filter({ hasText: 'failures.example.com' });
    await expect(item).toContainText('Failures: 3');
  });
});
