/**
 * Agent dashboard and agent registration tests
 */
import { test, expect } from '../fixtures';

test.describe('Agents', () => {
  test('navAgents button is visible in the sidebar', async ({ app }) => {
    await app.goto();

    await expect(app.navAgents).toBeVisible();
  });

  test('clicking navAgents opens the agent dashboard', async ({ app }) => {
    await app.goto();

    await app.navAgents.click();

    await expect(app.page.getByTestId('agent-dashboard')).toBeVisible();
  });

  test('agent dashboard shows empty state when no active agents', async ({ app }) => {
    await app.goto();
    await app.navAgents.click();

    await expect(app.page.getByTestId('agent-empty')).toBeVisible();
  });

  test('agent dashboard closes when clicking the backdrop', async ({ app }) => {
    await app.goto();
    await app.navAgents.click();
    await expect(app.page.getByTestId('agent-dashboard')).toBeVisible();

    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('agent-dashboard')).not.toBeVisible();
  });

  test('seeded active agent appears as a card in the dashboard', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.agents.push({
        id: 'agent-test-1',
        name: 'research-bot',
        description: 'Research assistant',
        capabilities: ['search'],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navAgents.click();

    await expect(app.page.getByTestId('agent-card').filter({ hasText: 'research-bot' })).toBeVisible();
    await expect(app.page.getByTestId('agent-empty')).not.toBeVisible();
  });

  test('settings panel has an agent registration form toggle', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();

    await expect(app.page.getByTestId('agent-register-toggle-btn')).toBeVisible();
  });

  test('clicking "+ Register" shows the agent registration form', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();

    await app.page.getByTestId('agent-register-toggle-btn').click();

    await expect(app.page.getByTestId('agent-register-form')).toBeVisible();
    await expect(app.page.getByTestId('agent-name-input')).toBeVisible();
    await expect(app.page.getByTestId('agent-register-btn')).toBeVisible();
  });

  test('registering an agent adds it to the agent list in settings', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();

    await app.page.getByTestId('agent-register-toggle-btn').click();
    await app.page.getByTestId('agent-name-input').fill('my-agent');
    await app.page.getByTestId('agent-register-btn').click();

    await expect(app.page.getByTestId('agent-item').filter({ hasText: 'my-agent' })).toBeVisible();
  });

  test('register button is disabled when agent name is empty', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();

    await app.page.getByTestId('agent-register-toggle-btn').click();

    await expect(app.page.getByTestId('agent-register-btn')).toBeDisabled();
  });
});
