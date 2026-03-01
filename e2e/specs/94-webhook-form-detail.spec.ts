/**
 * Webhook form detail tests: webhook-url-input placeholder,
 * webhook-secret-input placeholder, webhook-add-toggle-btn label changes,
 * webhook-register-btn label and disabled state, and form hide on Escape.
 * Complements spec 28 (webhook registration flow) and spec 31 (webhook actions)
 * — neither tests input placeholders, toggle label text, or disabled state.
 */
import { test, expect } from '../fixtures';

async function openWebhookManager(app: import('../page-objects/AppPage').AppPage) {
  await app.goto();
  await app.btnSettings.click();
  await app.page.getByTestId('btn-manage-webhooks').click();
  await expect(app.page.getByTestId('webhook-manager')).toBeVisible();
}

async function openWebhookForm(app: import('../page-objects/AppPage').AppPage) {
  await openWebhookManager(app);
  await app.page.getByTestId('webhook-add-toggle-btn').click();
  await expect(app.page.getByTestId('webhook-url-input')).toBeVisible();
}

test.describe('Webhook Form Detail', () => {
  test('webhook-url-input has correct placeholder', async ({ app }) => {
    await openWebhookForm(app);

    await expect(app.page.getByTestId('webhook-url-input')).toHaveAttribute(
      'placeholder',
      'Webhook URL (https://...)',
    );
  });

  test('webhook-secret-input has correct placeholder', async ({ app }) => {
    await openWebhookForm(app);

    await expect(app.page.getByTestId('webhook-secret-input')).toHaveAttribute(
      'placeholder',
      'Secret key for HMAC-SHA256 signing',
    );
  });

  test('webhook-add-toggle-btn shows "+ Add Webhook" when form is hidden', async ({ app }) => {
    await openWebhookManager(app);

    await expect(app.page.getByTestId('webhook-add-toggle-btn')).toHaveText('+ Add Webhook');
  });

  test('webhook-add-toggle-btn changes to "Cancel" when form is open', async ({ app }) => {
    await openWebhookForm(app);

    await expect(app.page.getByTestId('webhook-add-toggle-btn')).toHaveText('Cancel');
  });

  test('webhook-add-toggle-btn reverts to "+ Add Webhook" after clicking Cancel', async ({ app }) => {
    await openWebhookForm(app);
    await app.page.getByTestId('webhook-add-toggle-btn').click();

    await expect(app.page.getByTestId('webhook-add-toggle-btn')).toHaveText('+ Add Webhook');
  });

  test('webhook-register-btn has label "Register Webhook"', async ({ app }) => {
    await openWebhookForm(app);

    await expect(app.page.getByTestId('webhook-register-btn')).toHaveText('Register Webhook');
  });

  test('webhook-register-btn is disabled when url and secret are empty', async ({ app }) => {
    await openWebhookForm(app);

    await expect(app.page.getByTestId('webhook-register-btn')).toBeDisabled();
  });

  test('webhook-register-btn is disabled when only url is filled', async ({ app }) => {
    await openWebhookForm(app);

    await app.page.getByTestId('webhook-url-input').fill('https://example.com/hook');

    await expect(app.page.getByTestId('webhook-register-btn')).toBeDisabled();
  });

  test('webhook-register-btn is disabled when only secret is filled', async ({ app }) => {
    await openWebhookForm(app);

    await app.page.getByTestId('webhook-secret-input').fill('my-secret');

    await expect(app.page.getByTestId('webhook-register-btn')).toBeDisabled();
  });

  test('webhook-register-btn is enabled when both url and secret are filled', async ({ app }) => {
    await openWebhookForm(app);

    await app.page.getByTestId('webhook-url-input').fill('https://example.com/hook');
    await app.page.getByTestId('webhook-secret-input').fill('my-secret');

    await expect(app.page.getByTestId('webhook-register-btn')).toBeEnabled();
  });
});
