/**
 * Webhook manager tests: open, empty state, add, list, delete
 */
import { test, expect } from '../fixtures';

test.describe('Webhooks', () => {
  test('"Manage Webhooks" button is visible in settings', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();

    await expect(app.page.getByTestId('btn-manage-webhooks')).toBeVisible();
  });

  test('clicking "Manage Webhooks" opens the webhook manager', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();
    await app.page.getByTestId('btn-manage-webhooks').click();

    await expect(app.page.getByTestId('webhook-manager')).toBeVisible();
  });

  test('webhook manager shows empty state when no webhooks exist', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();
    await app.page.getByTestId('btn-manage-webhooks').click();

    await expect(app.page.getByTestId('webhook-empty')).toBeVisible();
  });

  test('webhook manager closes when clicking the backdrop', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();
    await app.page.getByTestId('btn-manage-webhooks').click();
    await expect(app.page.getByTestId('webhook-manager')).toBeVisible();

    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('webhook-manager')).not.toBeVisible();
  });

  test('"+ Add Webhook" button shows the registration form', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();
    await app.page.getByTestId('btn-manage-webhooks').click();

    await app.page.getByTestId('webhook-add-toggle-btn').click();

    await expect(app.page.getByTestId('webhook-url-input')).toBeVisible();
    await expect(app.page.getByTestId('webhook-secret-input')).toBeVisible();
    await expect(app.page.getByTestId('webhook-register-btn')).toBeVisible();
  });

  test('register button is disabled when URL or secret is empty', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();
    await app.page.getByTestId('btn-manage-webhooks').click();
    await app.page.getByTestId('webhook-add-toggle-btn').click();

    await expect(app.page.getByTestId('webhook-register-btn')).toBeDisabled();

    await app.page.getByTestId('webhook-url-input').fill('https://example.com/hook');
    await expect(app.page.getByTestId('webhook-register-btn')).toBeDisabled();
  });

  test('registering a webhook adds it to the list', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();
    await app.page.getByTestId('btn-manage-webhooks').click();
    await app.page.getByTestId('webhook-add-toggle-btn').click();

    await app.page.getByTestId('webhook-url-input').fill('https://example.com/hook');
    await app.page.getByTestId('webhook-secret-input').fill('my-secret-key');
    await app.page.getByTestId('webhook-register-btn').click();

    await expect(app.page.getByTestId('webhook-item').filter({ hasText: 'example.com/hook' })).toBeVisible();
    await expect(app.page.getByTestId('webhook-empty')).not.toBeVisible();
  });

  test('seeded webhook appears in the webhook list', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.webhooks.push({
        id: 'wh-seeded',
        url: 'https://hooks.example.org/notify',
        event_types: ['note_created'],
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

    await expect(app.page.getByTestId('webhook-item').filter({ hasText: 'hooks.example.org' })).toBeVisible();
  });
});
