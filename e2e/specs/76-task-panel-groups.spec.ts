/**
 * Task panel group header text and filter button label tests.
 * Complements specs 11 (basic CRUD), 40 (seeded statuses), 51 (advanced display) —
 * none test the group header text content or filter button labels.
 */
import { test, expect } from '../fixtures';

function seedTask(
  app: import('../page-objects/AppPage').AppPage,
  id: string,
  title: string,
  status: 'todo' | 'in_progress' | 'done',
) {
  return app.page.addInitScript(
    (args: { id: string; title: string; status: string }) => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push({
        id: args.id,
        title: args.title,
        status: args.status,
        priority: 'medium',
        note_id: null,
        agent_id: null,
        due_date: null,
        created_at: now,
        updated_at: now,
      });
    },
    { id, title, status },
  );
}

test.describe('Task Panel Groups', () => {
  test('task-list-empty shows "No tasks yet" when no tasks exist', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await expect(app.page.getByTestId('task-list-empty')).toHaveText('No tasks yet');
  });

  test('"todo" task group header contains "To Do"', async ({ app }) => {
    await seedTask(app, 'tg-todo-1', 'Pending Task', 'todo');
    await app.goto();
    await app.navTasks.click();

    const group = app.page.locator('[data-testid="task-group"][data-status="todo"]');
    await expect(group).toContainText('To Do');
  });

  test('"in_progress" task group header contains "In Progress"', async ({ app }) => {
    await seedTask(app, 'tg-ip-1', 'Active Task', 'in_progress');
    await app.goto();
    await app.navTasks.click();

    const group = app.page.locator('[data-testid="task-group"][data-status="in_progress"]');
    await expect(group).toContainText('In Progress');
  });

  test('"done" task group header contains "Done"', async ({ app }) => {
    await seedTask(app, 'tg-done-1', 'Finished Task', 'done');
    await app.goto();
    await app.navTasks.click();

    const group = app.page.locator('[data-testid="task-group"][data-status="done"]');
    await expect(group).toContainText('Done');
  });

  test('task group header shows the task count in parentheses', async ({ app }) => {
    await seedTask(app, 'tg-cnt-1', 'Count Task A', 'todo');
    await seedTask(app, 'tg-cnt-2', 'Count Task B', 'todo');
    await app.goto();
    await app.navTasks.click();

    const group = app.page.locator('[data-testid="task-group"][data-status="todo"]');
    // Header text is "To Do (2)"
    await expect(group).toContainText('(2)');
  });

  test('filter buttons include "All", "To Do", "In Progress", "Done" labels', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    const filterBtns = app.page.getByTestId('task-filter-btn');
    await expect(filterBtns.filter({ hasText: /^All$/ })).toBeVisible();
    await expect(filterBtns.filter({ hasText: /^To Do$/ })).toBeVisible();
    await expect(filterBtns.filter({ hasText: /^In Progress$/ })).toBeVisible();
    await expect(filterBtns.filter({ hasText: /^Done$/ })).toBeVisible();
  });

  test('clicking "To Do" filter hides in_progress tasks', async ({ app }) => {
    await seedTask(app, 'tg-flt-todo', 'Filter Todo Task', 'todo');
    await seedTask(app, 'tg-flt-ip',   'Filter IP Task',   'in_progress');
    await app.goto();
    await app.navTasks.click();

    // Click "To Do" filter button
    await app.page.getByTestId('task-filter-btn').filter({ hasText: /^To Do$/ }).click();

    await expect(app.page.getByTestId('task-item').filter({ hasText: 'Filter Todo Task' })).toBeVisible();
    await expect(app.page.getByTestId('task-item').filter({ hasText: 'Filter IP Task' })).not.toBeVisible();
  });

  test('clicking "All" filter after narrowing restores all task groups', async ({ app }) => {
    await seedTask(app, 'tg-all-todo', 'All Todo Task', 'todo');
    await seedTask(app, 'tg-all-done', 'All Done Task', 'done');
    await app.goto();
    await app.navTasks.click();

    // Narrow to "Done"
    await app.page.getByTestId('task-filter-btn').filter({ hasText: /^Done$/ }).click();
    await expect(app.page.getByTestId('task-item').filter({ hasText: 'All Todo Task' })).not.toBeVisible();

    // Restore all
    await app.page.getByTestId('task-filter-btn').filter({ hasText: /^All$/ }).click();
    await expect(app.page.getByTestId('task-item').filter({ hasText: 'All Todo Task' })).toBeVisible();
    await expect(app.page.getByTestId('task-item').filter({ hasText: 'All Done Task' })).toBeVisible();
  });
});
