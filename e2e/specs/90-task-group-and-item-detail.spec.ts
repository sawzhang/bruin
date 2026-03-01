/**
 * Task group and item detail tests: task-group via getByTestId() directly
 * (all prior specs use locator('[data-testid="task-group"][data-status="..."]')
 * attribute-selector syntax), task-item data-task-id attribute, and
 * task-delete-btn removing the task from the list.
 * Complements spec 11 (task CRUD) and spec 40 (seeded task groups).
 */
import { test, expect } from '../fixtures';

async function openTaskPanel(app: import('../page-objects/AppPage').AppPage) {
  await app.navTasks.click();
  await expect(app.page.getByTestId('task-panel')).toBeVisible();
}

test.describe('Task Group and Item Detail', () => {
  test('task-group elements are present after creating tasks in each status', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push(
        { id: 'tg-t1', title: 'Todo Task', status: 'todo', priority: 'medium', agent_id: null, created_at: now, updated_at: now },
        { id: 'tg-t2', title: 'Progress Task', status: 'in_progress', priority: 'medium', agent_id: null, created_at: now, updated_at: now },
        { id: 'tg-t3', title: 'Done Task', status: 'done', priority: 'medium', agent_id: null, created_at: now, updated_at: now },
      );
    });
    await app.goto();
    await openTaskPanel(app);

    // All three groups should be present
    await expect(app.page.getByTestId('task-group')).toHaveCount(3);
  });

  test('task-group has data-status attribute', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push(
        { id: 'ds-t1', title: 'Data Status Task', status: 'todo', priority: 'medium', agent_id: null, created_at: now, updated_at: now },
      );
    });
    await app.goto();
    await openTaskPanel(app);

    const todoGroup = app.page.getByTestId('task-group').first();
    await expect(todoGroup).toHaveAttribute('data-status', 'todo');
  });

  test('task-item has data-task-id attribute matching the task id', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push(
        { id: 'task-attr-id-42', title: 'ID Attr Task', status: 'todo', priority: 'medium', agent_id: null, created_at: now, updated_at: now },
      );
    });
    await app.goto();
    await openTaskPanel(app);

    const item = app.page.getByTestId('task-item').filter({ hasText: 'ID Attr Task' });
    await expect(item).toHaveAttribute('data-task-id', 'task-attr-id-42');
  });

  test('task-delete-btn removes the task from the list', async ({ app }) => {
    await app.goto();
    await openTaskPanel(app);

    await app.page.getByTestId('task-title-input').fill('Task To Delete');
    await app.page.getByTestId('task-submit-btn').click();

    const item = app.page.getByTestId('task-item').filter({ hasText: 'Task To Delete' });
    await expect(item).toBeVisible();

    await item.getByTestId('task-delete-btn').click({ force: true });

    await expect(app.page.getByTestId('task-item').filter({ hasText: 'Task To Delete' })).not.toBeVisible();
  });

  test('task-delete-btn is present inside each task-item', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push(
        { id: 'del-btn-t1', title: 'Delete Btn Task', status: 'todo', priority: 'medium', agent_id: null, created_at: now, updated_at: now },
      );
    });
    await app.goto();
    await openTaskPanel(app);

    const item = app.page.getByTestId('task-item').filter({ hasText: 'Delete Btn Task' });
    await expect(item.getByTestId('task-delete-btn')).toBeAttached();
  });

  test('after deleting a task, task-list-empty is visible if no tasks remain', async ({ app }) => {
    await app.goto();
    await openTaskPanel(app);

    await app.page.getByTestId('task-title-input').fill('Last Task');
    await app.page.getByTestId('task-submit-btn').click();

    const item = app.page.getByTestId('task-item').filter({ hasText: 'Last Task' });
    await item.getByTestId('task-delete-btn').click({ force: true });

    await expect(app.page.getByTestId('task-list-empty')).toBeVisible();
  });
});
