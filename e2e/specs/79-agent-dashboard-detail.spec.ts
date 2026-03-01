/**
 * Agent dashboard heading, empty-state text, and agent-card visual detail tests.
 * Complements spec 20 (open/close/backdrop/empty visibility) and spec 47
 * (description/capabilities/counts) — neither tests the heading text,
 * exact empty-state message, green status dot, or coloured task-count spans.
 */
import { test, expect } from '../fixtures';

async function openDashboard(app: import('../page-objects/AppPage').AppPage) {
  await app.navAgents.click();
  await expect(app.page.getByTestId('agent-dashboard')).toBeVisible();
}

function seedAgent(app: import('../page-objects/AppPage').AppPage, id: string, name: string) {
  return app.page.addInitScript(
    (args: { id: string; name: string }) => {
      window.__TAURI_MOCK_DB__.agents.push({
        id: args.id,
        name: args.name,
        description: '',
        capabilities: [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },
    { id, name },
  );
}

test.describe('Agent Dashboard Detail', () => {
  test('dashboard heading is "Agent Dashboard"', async ({ app }) => {
    await app.goto();
    await openDashboard(app);

    await expect(
      app.page.getByTestId('agent-dashboard').getByRole('heading', { name: 'Agent Dashboard' }),
    ).toBeVisible();
  });

  test('agent-empty says "No active agents. Register agents in Settings."', async ({ app }) => {
    await app.goto();
    await openDashboard(app);

    await expect(app.page.getByTestId('agent-empty')).toHaveText(
      'No active agents. Register agents in Settings.',
    );
  });

  test('× button closes the agent dashboard', async ({ app }) => {
    await app.goto();
    await openDashboard(app);

    await app.page.getByTestId('agent-dashboard').getByRole('button', { name: '×' }).click();

    await expect(app.page.getByTestId('agent-dashboard')).not.toBeVisible();
  });

  test('agent card shows a green status dot (span.bg-green-500)', async ({ app }) => {
    await seedAgent(app, 'dash-dot-1', 'dot-agent');
    await app.goto();
    await openDashboard(app);

    const card = app.page.getByTestId('agent-card').filter({ hasText: 'dot-agent' });
    await expect(card.locator('span.bg-green-500').first()).toBeVisible();
  });

  test('agent card displays the agent name', async ({ app }) => {
    await seedAgent(app, 'dash-name-1', 'named-agent-bot');
    await app.goto();
    await openDashboard(app);

    await expect(
      app.page.getByTestId('agent-card').filter({ hasText: 'named-agent-bot' })
    ).toBeVisible();
  });

  test('agent card todo count span uses text-yellow-500 class', async ({ app }) => {
    await seedAgent(app, 'dash-todo-1', 'todo-count-agent');
    await app.goto();
    await openDashboard(app);

    const card = app.page.getByTestId('agent-card').filter({ hasText: 'todo-count-agent' });
    // Even with 0 tasks, the colored span renders; it shows "0"
    await expect(card.locator('span.text-yellow-500')).toBeVisible();
    await expect(card.locator('span.text-yellow-500')).toHaveText('0');
  });

  test('agent card in-progress count span uses text-blue-500 class', async ({ app }) => {
    await seedAgent(app, 'dash-ip-1', 'ip-count-agent');
    await app.goto();
    await openDashboard(app);

    const card = app.page.getByTestId('agent-card').filter({ hasText: 'ip-count-agent' });
    await expect(card.locator('span.text-blue-500')).toHaveText('0');
  });

  test('agent card done count span uses text-green-500 class', async ({ app }) => {
    await seedAgent(app, 'dash-done-1', 'done-count-agent');
    await app.goto();
    await openDashboard(app);

    const card = app.page.getByTestId('agent-card').filter({ hasText: 'done-count-agent' });
    // The done count span has text-green-500 (different from the status dot)
    const doneSpan = card.locator('span.text-green-500').last();
    await expect(doneSpan).toHaveText('0');
  });
});
