/**
 * Agent deactivation tests: deactivate from settings, removed from dashboard
 */
import { test, expect } from '../fixtures';

test.describe('Agent Deactivation', () => {
  test('registered agent shows the deactivate button in settings', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();

    await app.page.getByTestId('agent-register-toggle-btn').click();
    await app.page.getByTestId('agent-name-input').fill('cleanup-bot');
    await app.page.getByTestId('agent-register-btn').click();

    await expect(
      app.page
        .getByTestId('agent-item')
        .filter({ hasText: 'cleanup-bot' })
        .getByTestId('agent-deactivate-btn')
    ).toBeVisible();
  });

  test('deactivating an agent removes it from the agent dashboard', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.agents.push({
        id: 'agent-deact-1',
        name: 'dashboard-bot',
        description: '',
        capabilities: [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
    await app.goto();

    // Deactivate from settings panel
    await app.btnSettings.click();
    await app.page
      .getByTestId('agent-item')
      .filter({ hasText: 'dashboard-bot' })
      .getByTestId('agent-deactivate-btn')
      .click();

    // Close settings, open agent dashboard
    await app.page.mouse.click(10, 10);
    await app.navAgents.click();

    // Agent is no longer active — dashboard shows empty state
    await expect(app.page.getByTestId('agent-card').filter({ hasText: 'dashboard-bot' })).not.toBeVisible();
    await expect(app.page.getByTestId('agent-empty')).toBeVisible();
  });

  test('deactivated agent loses the deactivate button in settings', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.agents.push({
        id: 'agent-deact-2',
        name: 'grey-bot',
        description: '',
        capabilities: [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.btnSettings.click();

    const agentItem = app.page.getByTestId('agent-item').filter({ hasText: 'grey-bot' });

    // Deactivate
    await agentItem.getByTestId('agent-deactivate-btn').click();

    // Deactivate button should no longer be visible for this agent
    await expect(agentItem.getByTestId('agent-deactivate-btn')).not.toBeVisible();
  });

  test('multiple active agents can each be deactivated independently', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.agents.push(
        {
          id: 'agent-multi-1', name: 'bot-one', description: '', capabilities: [],
          is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        },
        {
          id: 'agent-multi-2', name: 'bot-two', description: '', capabilities: [],
          is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        },
      );
    });
    await app.goto();
    await app.btnSettings.click();

    // Deactivate only bot-one
    await app.page
      .getByTestId('agent-item')
      .filter({ hasText: 'bot-one' })
      .getByTestId('agent-deactivate-btn')
      .click();

    // bot-two still has its deactivate button
    await expect(
      app.page.getByTestId('agent-item').filter({ hasText: 'bot-two' }).getByTestId('agent-deactivate-btn')
    ).toBeVisible();
  });
});
