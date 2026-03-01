/**
 * Tasks panel tests: create, complete, delete, filter
 */
import { test, expect } from '../fixtures';

test.describe('Tasks', () => {
  test('clicking Tasks nav opens the task panel', async ({ app }) => {
    await app.goto();

    await app.navTasks.click();

    await expect(app.page.getByTestId('task-panel')).toBeVisible();
  });

  test('task panel shows empty state when no tasks exist', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await expect(app.page.getByTestId('task-list-empty')).toBeVisible();
  });

  test('task panel has filter buttons for All, To Do, In Progress, Done', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await expect(app.page.locator('[data-testid="task-filter-btn"][data-filter="all"]')).toBeVisible();
    await expect(app.page.locator('[data-testid="task-filter-btn"][data-filter="todo"]')).toBeVisible();
    await expect(app.page.locator('[data-testid="task-filter-btn"][data-filter="in_progress"]')).toBeVisible();
    await expect(app.page.locator('[data-testid="task-filter-btn"][data-filter="done"]')).toBeVisible();
  });

  test('creating a task via the form adds it to the list', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-title-input').fill('Write tests');
    await app.page.getByTestId('task-submit-btn').click();

    await expect(
      app.page.getByTestId('task-item').filter({ hasText: 'Write tests' })
    ).toBeVisible();
  });

  test('form clears after task creation', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-title-input').fill('Temporary task');
    await app.page.getByTestId('task-submit-btn').click();

    await expect(app.page.getByTestId('task-title-input')).toHaveValue('');
  });

  test('new task appears in the To Do group', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-title-input').fill('Pending task');
    await app.page.getByTestId('task-submit-btn').click();

    const todoGroup = app.page.locator('[data-testid="task-group"][data-status="todo"]');
    await expect(todoGroup.getByTestId('task-item').filter({ hasText: 'Pending task' })).toBeVisible();
  });

  test('pressing Enter in the task input creates the task', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-title-input').fill('Enter task');
    await app.page.keyboard.press('Enter');

    await expect(
      app.page.getByTestId('task-item').filter({ hasText: 'Enter task' })
    ).toBeVisible();
  });

  test('completing a task moves it to the Done group', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    // Create a task
    await app.page.getByTestId('task-title-input').fill('Finish me');
    await app.page.getByTestId('task-submit-btn').click();

    // Complete it
    const taskItem = app.page.getByTestId('task-item').filter({ hasText: 'Finish me' });
    await taskItem.getByTestId('task-complete-btn').click();

    // Should now be in Done group
    const doneGroup = app.page.locator('[data-testid="task-group"][data-status="done"]');
    await expect(doneGroup.getByTestId('task-item').filter({ hasText: 'Finish me' })).toBeVisible();
  });

  test('deleting a task removes it from the list', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-title-input').fill('Delete me');
    await app.page.getByTestId('task-submit-btn').click();

    const taskItem = app.page.getByTestId('task-item').filter({ hasText: 'Delete me' });
    await expect(taskItem).toBeVisible();

    // Hover to reveal the delete button (force-click since it's opacity-0)
    await taskItem.getByTestId('task-delete-btn').click({ force: true });

    await expect(taskItem).not.toBeVisible();
    await expect(app.page.getByTestId('task-list-empty')).toBeVisible();
  });

  test('priority select defaults to medium and can be changed', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    const select = app.page.getByTestId('task-priority-select');
    await expect(select).toHaveValue('medium');

    await select.selectOption('high');
    await expect(select).toHaveValue('high');
  });

  test('filtering by To Do hides Done tasks', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    // Create and complete a task
    await app.page.getByTestId('task-title-input').fill('Done task');
    await app.page.getByTestId('task-submit-btn').click();
    const item = app.page.getByTestId('task-item').filter({ hasText: 'Done task' });
    await item.getByTestId('task-complete-btn').click();

    // Create a to-do task
    await app.page.getByTestId('task-title-input').fill('Todo task');
    await app.page.getByTestId('task-submit-btn').click();

    // Filter by To Do
    await app.page.locator('[data-testid="task-filter-btn"][data-filter="todo"]').click();

    await expect(app.page.getByTestId('task-item').filter({ hasText: 'Todo task' })).toBeVisible();
    await expect(app.page.getByTestId('task-item').filter({ hasText: 'Done task' })).not.toBeVisible();
  });
});
