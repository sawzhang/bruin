/**
 * Agent registration form detail tests: Cancel behaviour, placeholder text,
 * form reset after registration, and description-optional flow.
 * Complements spec 55 which covers form visibility, disabled/enabled state,
 * "Cancel" label, and registration with description — but not form hide/reset.
 */
import { test, expect } from '../fixtures';

async function openSettingsAndForm(app: import('../page-objects/AppPage').AppPage) {
  await app.goto();
  await app.btnSettings.click();
  await expect(app.page.getByTestId('settings-panel')).toBeVisible();
  await app.page.getByTestId('agent-register-toggle-btn').click();
  await expect(app.page.getByTestId('agent-register-form')).toBeVisible();
}

test.describe('Agent Register Form Detail', () => {
  test('clicking Cancel button hides the registration form', async ({ app }) => {
    await openSettingsAndForm(app);

    await app.page.getByTestId('agent-register-toggle-btn').click();

    await expect(app.page.getByTestId('agent-register-form')).not.toBeVisible();
  });

  test('clicking Cancel button restores "+ Register" label on toggle', async ({ app }) => {
    await openSettingsAndForm(app);

    await app.page.getByTestId('agent-register-toggle-btn').click();

    await expect(app.page.getByTestId('agent-register-toggle-btn')).toHaveText('+ Register');
  });

  test('agent-name-input has placeholder "Agent name (e.g. research-bot)"', async ({ app }) => {
    await openSettingsAndForm(app);

    await expect(app.page.getByTestId('agent-name-input')).toHaveAttribute(
      'placeholder',
      'Agent name (e.g. research-bot)',
    );
  });

  test('agent-description-input has placeholder "Description (optional)"', async ({ app }) => {
    await openSettingsAndForm(app);

    await expect(app.page.getByTestId('agent-description-input')).toHaveAttribute(
      'placeholder',
      'Description (optional)',
    );
  });

  test('form collapses after successful registration', async ({ app }) => {
    await openSettingsAndForm(app);

    await app.page.getByTestId('agent-name-input').fill('collapse-bot');
    await app.page.getByTestId('agent-register-btn').click();

    await expect(app.page.getByTestId('agent-register-form')).not.toBeVisible();
  });

  test('toggle button shows "+ Register" again after successful registration', async ({ app }) => {
    await openSettingsAndForm(app);

    await app.page.getByTestId('agent-name-input').fill('reset-toggle-bot');
    await app.page.getByTestId('agent-register-btn').click();

    await expect(app.page.getByTestId('agent-register-toggle-btn')).toHaveText('+ Register');
  });

  test('registering with only a name (no description) succeeds', async ({ app }) => {
    await openSettingsAndForm(app);

    await app.page.getByTestId('agent-name-input').fill('no-desc-bot');
    // Leave description empty
    await app.page.getByTestId('agent-register-btn').click();

    await expect(
      app.page.getByTestId('agent-item').filter({ hasText: 'no-desc-bot' })
    ).toBeVisible();
  });
});
