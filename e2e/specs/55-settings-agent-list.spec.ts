/**
 * Agent registration panel inside Settings tests: empty state, toggle form,
 * registration flow, Cancel label, and default-workspace select options.
 * Complements spec 30 (deactivation) and spec 20 (agents overview).
 */
import { test, expect } from '../fixtures';

async function openSettings(app: import('../page-objects/AppPage').AppPage) {
  await app.goto();
  await app.btnSettings.click();
  await expect(app.page.getByTestId('settings-panel')).toBeVisible();
}

test.describe('Settings Agent List', () => {
  test('settings panel shows "No agents registered yet" when no agents exist', async ({ app }) => {
    await openSettings(app);

    await expect(app.page.getByTestId('settings-panel')).toContainText('No agents registered yet');
  });

  test('"+ Register" toggle button is visible in the agents section', async ({ app }) => {
    await openSettings(app);

    await expect(app.page.getByTestId('agent-register-toggle-btn')).toBeVisible();
    await expect(app.page.getByTestId('agent-register-toggle-btn')).toHaveText('+ Register');
  });

  test('clicking "+ Register" shows the agent registration form', async ({ app }) => {
    await openSettings(app);

    await app.page.getByTestId('agent-register-toggle-btn').click();

    await expect(app.page.getByTestId('agent-register-form')).toBeVisible();
    await expect(app.page.getByTestId('agent-name-input')).toBeVisible();
    await expect(app.page.getByTestId('agent-description-input')).toBeVisible();
    await expect(app.page.getByTestId('agent-register-btn')).toBeVisible();
  });

  test('agent register button is disabled when name input is empty', async ({ app }) => {
    await openSettings(app);
    await app.page.getByTestId('agent-register-toggle-btn').click();

    await expect(app.page.getByTestId('agent-register-btn')).toBeDisabled();
  });

  test('agent register button is enabled after typing a name', async ({ app }) => {
    await openSettings(app);
    await app.page.getByTestId('agent-register-toggle-btn').click();

    await app.page.getByTestId('agent-name-input').fill('new-bot');

    await expect(app.page.getByTestId('agent-register-btn')).toBeEnabled();
  });

  test('"Cancel" text appears on toggle button when form is visible', async ({ app }) => {
    await openSettings(app);
    await app.page.getByTestId('agent-register-toggle-btn').click();

    await expect(app.page.getByTestId('agent-register-toggle-btn')).toHaveText('Cancel');
  });

  test('registering an agent adds it to the agent list in settings', async ({ app }) => {
    await openSettings(app);
    await app.page.getByTestId('agent-register-toggle-btn').click();

    await app.page.getByTestId('agent-name-input').fill('registered-bot');
    await app.page.getByTestId('agent-register-btn').click();

    await expect(
      app.page.getByTestId('agent-item').filter({ hasText: 'registered-bot' })
    ).toBeVisible();
  });

  test('registered agent shows green active indicator dot', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.agents.push({
        id: 'ag-settings-1',
        name: 'settings-active-bot',
        description: '',
        capabilities: [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
    await openSettings(app);

    const item = app.page.getByTestId('agent-item').filter({ hasText: 'settings-active-bot' });
    await expect(item.locator('span.bg-green-500')).toBeVisible();
  });

  test('agent registered with description shows description in item', async ({ app }) => {
    await openSettings(app);
    await app.page.getByTestId('agent-register-toggle-btn').click();

    await app.page.getByTestId('agent-name-input').fill('desc-bot');
    await app.page.getByTestId('agent-description-input').fill('Does research tasks');
    await app.page.getByTestId('agent-register-btn').click();

    const item = app.page.getByTestId('agent-item').filter({ hasText: 'desc-bot' });
    await expect(item).toContainText('Does research tasks');
  });

  test('default workspace select shows "None" as first option', async ({ app }) => {
    await openSettings(app);

    // The default workspace select is inside the settings panel
    const panel = app.page.getByTestId('settings-panel');
    const workspaceSelect = panel.locator('select').last();
    const firstOption = workspaceSelect.locator('option').first();
    await expect(firstOption).toHaveText('None');
  });

  test('default workspace select lists seeded workspaces as options', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workspaces.push({ id: 'ws-defaults-1', name: 'Work Projects' });
    });
    await openSettings(app);

    const panel = app.page.getByTestId('settings-panel');
    const workspaceSelect = panel.locator('select').last();
    await expect(workspaceSelect.locator('option', { hasText: 'Work Projects' })).toBeAttached();
  });
});
