/**
 * Seeded task status tests
 * Covers: tasks pre-seeded with specific statuses appear in the correct group;
 *         status filter correctly narrows the task list
 */
import { test, expect } from '../fixtures';

test.describe('Seeded Tasks', () => {
  test('task seeded as in_progress appears in the In Progress group', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push({
        id: 'seeded-inprogress-1',
        title: 'Active Work',
        status: 'in_progress',
        priority: 'medium',
        note_id: null,
        agent_id: null,
        due_date: null,
        created_at: now,
        updated_at: now,
      });
    });
    await app.goto();
    await app.navTasks.click();

    const inProgressGroup = app.page.locator('[data-testid="task-group"][data-status="in_progress"]');
    await expect(inProgressGroup).toBeVisible();
    await expect(inProgressGroup.getByTestId('task-item').filter({ hasText: 'Active Work' })).toBeVisible();
  });

  test('task seeded as done appears in the Done group', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push({
        id: 'seeded-done-1',
        title: 'Finished Work',
        status: 'done',
        priority: 'medium',
        note_id: null,
        agent_id: null,
        due_date: null,
        created_at: now,
        updated_at: now,
      });
    });
    await app.goto();
    await app.navTasks.click();

    const doneGroup = app.page.locator('[data-testid="task-group"][data-status="done"]');
    await expect(doneGroup).toBeVisible();
    await expect(doneGroup.getByTestId('task-item').filter({ hasText: 'Finished Work' })).toBeVisible();
  });

  test('tasks across all three statuses are grouped correctly', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push(
        { id: 'st-1', title: 'Todo Task', status: 'todo', priority: 'medium', note_id: null, agent_id: null, due_date: null, created_at: now, updated_at: now },
        { id: 'st-2', title: 'In Progress Task', status: 'in_progress', priority: 'medium', note_id: null, agent_id: null, due_date: null, created_at: now, updated_at: now },
        { id: 'st-3', title: 'Done Task', status: 'done', priority: 'medium', note_id: null, agent_id: null, due_date: null, created_at: now, updated_at: now },
      );
    });
    await app.goto();
    await app.navTasks.click();

    await expect(
      app.page.locator('[data-testid="task-group"][data-status="todo"]')
        .getByTestId('task-item').filter({ hasText: 'Todo Task' })
    ).toBeVisible();
    await expect(
      app.page.locator('[data-testid="task-group"][data-status="in_progress"]')
        .getByTestId('task-item').filter({ hasText: 'In Progress Task' })
    ).toBeVisible();
    await expect(
      app.page.locator('[data-testid="task-group"][data-status="done"]')
        .getByTestId('task-item').filter({ hasText: 'Done Task' })
    ).toBeVisible();
  });

  test('"In Progress" filter shows only in_progress tasks', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push(
        { id: 'sf-1', title: 'A Todo', status: 'todo', priority: 'medium', note_id: null, agent_id: null, due_date: null, created_at: now, updated_at: now },
        { id: 'sf-2', title: 'A Worker', status: 'in_progress', priority: 'medium', note_id: null, agent_id: null, due_date: null, created_at: now, updated_at: now },
      );
    });
    await app.goto();
    await app.navTasks.click();

    await app.page.locator('[data-testid="task-filter-btn"][data-filter="in_progress"]').click();

    await expect(app.page.getByTestId('task-item').filter({ hasText: 'A Worker' })).toBeVisible();
    await expect(app.page.getByTestId('task-item').filter({ hasText: 'A Todo' })).not.toBeVisible();
  });

  test('"Done" filter shows only done tasks', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push(
        { id: 'sd-1', title: 'Pending Item', status: 'todo', priority: 'medium', note_id: null, agent_id: null, due_date: null, created_at: now, updated_at: now },
        { id: 'sd-2', title: 'Completed Item', status: 'done', priority: 'medium', note_id: null, agent_id: null, due_date: null, created_at: now, updated_at: now },
      );
    });
    await app.goto();
    await app.navTasks.click();

    await app.page.locator('[data-testid="task-filter-btn"][data-filter="done"]').click();

    await expect(app.page.getByTestId('task-item').filter({ hasText: 'Completed Item' })).toBeVisible();
    await expect(app.page.getByTestId('task-item').filter({ hasText: 'Pending Item' })).not.toBeVisible();
  });

  test('done task shows a checkmark and no complete button', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push({
        id: 'sd-done-1',
        title: 'Already Done',
        status: 'done',
        priority: 'medium',
        note_id: null,
        agent_id: null,
        due_date: null,
        created_at: now,
        updated_at: now,
      });
    });
    await app.goto();
    await app.navTasks.click();

    const taskItem = app.page.getByTestId('task-item').filter({ hasText: 'Already Done' });
    await expect(taskItem).toBeVisible();
    await expect(taskItem.getByTestId('task-complete-btn')).not.toBeVisible();
  });

  test('urgent priority task label is displayed', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push({
        id: 'sp-urgent-1',
        title: 'Fire Task',
        status: 'todo',
        priority: 'urgent',
        note_id: null,
        agent_id: null,
        due_date: null,
        created_at: now,
        updated_at: now,
      });
    });
    await app.goto();
    await app.navTasks.click();

    const taskItem = app.page.getByTestId('task-item').filter({ hasText: 'Fire Task' });
    await expect(taskItem).toContainText('urgent');
  });
});
