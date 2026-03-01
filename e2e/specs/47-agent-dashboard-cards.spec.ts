/**
 * Agent dashboard card detail tests: capabilities, description, task counts,
 * timestamp, × close button, and multi-agent display.
 */
import { test, expect } from '../fixtures';

function seedAgent(opts: {
  id: string;
  name: string;
  description?: string;
  capabilities?: string[];
  is_active?: boolean;
}) {
  return async ({ page }: { page: import('@playwright/test').Page }) => {
    await page.addInitScript((agent: typeof opts) => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.agents.push({
        id: agent.id,
        name: agent.name,
        description: agent.description ?? '',
        capabilities: agent.capabilities ?? [],
        is_active: agent.is_active ?? true,
        created_at: now,
        updated_at: now,
      });
    }, opts);
  };
}

test.describe('Agent Dashboard Cards', () => {
  test('agent card shows the agent description', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.agents.push({
        id: 'ag-desc-1',
        name: 'writer-bot',
        description: 'Writes drafts automatically',
        capabilities: [],
        is_active: true,
        created_at: now,
        updated_at: now,
      });
    });
    await app.goto();
    await app.navAgents.click();

    const card = app.page.getByTestId('agent-card').filter({ hasText: 'writer-bot' });
    await expect(card).toContainText('Writes drafts automatically');
  });

  test('agent card shows capability badges', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.agents.push({
        id: 'ag-cap-1',
        name: 'search-bot',
        description: '',
        capabilities: ['search', 'summarize'],
        is_active: true,
        created_at: now,
        updated_at: now,
      });
    });
    await app.goto();
    await app.navAgents.click();

    const card = app.page.getByTestId('agent-card').filter({ hasText: 'search-bot' });
    await expect(card.getByText('search')).toBeVisible();
    await expect(card.getByText('summarize')).toBeVisible();
  });

  test('agent card shows at most 3 capability badges even with 4+ capabilities', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.agents.push({
        id: 'ag-cap-2',
        name: 'full-bot',
        description: '',
        capabilities: ['read', 'write', 'search', 'delete'],
        is_active: true,
        created_at: now,
        updated_at: now,
      });
    });
    await app.goto();
    await app.navAgents.click();

    const card = app.page.getByTestId('agent-card').filter({ hasText: 'full-bot' });
    await expect(card.getByText('read')).toBeVisible();
    await expect(card.getByText('write')).toBeVisible();
    await expect(card.getByText('search')).toBeVisible();
    // 4th capability is cut off
    await expect(card.getByText('delete')).not.toBeVisible();
  });

  test('agent card shows task counts for tasks assigned to that agent', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.agents.push({
        id: 'ag-tasks-1',
        name: 'task-bot',
        description: '',
        capabilities: [],
        is_active: true,
        created_at: now,
        updated_at: now,
      });
      // 2 todos, 1 in_progress, 1 done
      ['todo', 'todo', 'in_progress', 'done'].forEach((status, i) => {
        window.__TAURI_MOCK_DB__.tasks.push({
          id: 'at-task-' + i,
          title: 'Task ' + i,
          status,
          priority: 'medium',
          note_id: null,
          agent_id: 'ag-tasks-1',
          assigned_agent_id: 'ag-tasks-1',
          due_date: null,
          created_at: now,
          updated_at: now,
        });
      });
    });
    await app.goto();
    await app.navAgents.click();

    const card = app.page.getByTestId('agent-card').filter({ hasText: 'task-bot' });
    await expect(card).toContainText('2');    // 2 todos
    await expect(card).toContainText('1');    // at least one "1" for in_progress and done
    await expect(card).toContainText('todo');
    await expect(card).toContainText('in progress');
    await expect(card).toContainText('done');
  });

  test('agent card shows a relative "Registered" timestamp', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.agents.push({
        id: 'ag-ts-1',
        name: 'time-bot',
        description: '',
        capabilities: [],
        is_active: true,
        created_at: now,
        updated_at: now,
      });
    });
    await app.goto();
    await app.navAgents.click();

    const card = app.page.getByTestId('agent-card').filter({ hasText: 'time-bot' });
    await expect(card).toContainText('Registered');
    await expect(card).toContainText('ago');
  });

  test('multiple seeded agents show separate cards', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      ['bot-alpha', 'bot-beta', 'bot-gamma'].forEach((name, i) => {
        window.__TAURI_MOCK_DB__.agents.push({
          id: 'ag-multi-' + i,
          name,
          description: '',
          capabilities: [],
          is_active: true,
          created_at: now,
          updated_at: now,
        });
      });
    });
    await app.goto();
    await app.navAgents.click();

    await expect(app.page.getByTestId('agent-card')).toHaveCount(3);
    await expect(app.page.getByTestId('agent-card').filter({ hasText: 'bot-alpha' })).toBeVisible();
    await expect(app.page.getByTestId('agent-card').filter({ hasText: 'bot-beta' })).toBeVisible();
    await expect(app.page.getByTestId('agent-card').filter({ hasText: 'bot-gamma' })).toBeVisible();
  });

  test('agent dashboard × button closes the dashboard', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.agents.push({
        id: 'ag-close-1',
        name: 'close-bot',
        description: '',
        capabilities: [],
        is_active: true,
        created_at: now,
        updated_at: now,
      });
    });
    await app.goto();
    await app.navAgents.click();
    await expect(app.page.getByTestId('agent-dashboard')).toBeVisible();

    await app.page.getByTestId('agent-dashboard').getByRole('button', { name: '×' }).click();

    await expect(app.page.getByTestId('agent-dashboard')).not.toBeVisible();
  });

  test('inactive agents are not shown in the dashboard', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.agents.push(
        {
          id: 'ag-active-1',
          name: 'active-bot',
          description: '',
          capabilities: [],
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: 'ag-inactive-1',
          name: 'inactive-bot',
          description: '',
          capabilities: [],
          is_active: false,
          created_at: now,
          updated_at: now,
        },
      );
    });
    await app.goto();
    await app.navAgents.click();

    await expect(app.page.getByTestId('agent-card').filter({ hasText: 'active-bot' })).toBeVisible();
    await expect(app.page.getByTestId('agent-card').filter({ hasText: 'inactive-bot' })).not.toBeVisible();
  });
});
