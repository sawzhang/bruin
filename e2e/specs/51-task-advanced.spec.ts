/**
 * Task panel advanced display tests: done-state strikethrough, green checkmark,
 * priority label colours, disabled submit button, and filter bar active state.
 * Complements spec 11 (basic task CRUD) and 40 (seeded task statuses).
 */
import { test, expect } from '../fixtures';

test.describe('Task Panel Advanced', () => {
  test('done task title has line-through styling', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    // Create and complete a task
    await app.page.getByTestId('task-title-input').fill('Complete me');
    await app.page.getByTestId('task-submit-btn').click();

    const item = app.page.getByTestId('task-item').filter({ hasText: 'Complete me' });
    await item.getByTestId('task-complete-btn').click();

    // The task title paragraph should have the line-through class when done
    await expect(item.locator('p.line-through')).toBeVisible();
  });

  test('done task shows green checkmark instead of the complete button', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-title-input').fill('Checked task');
    await app.page.getByTestId('task-submit-btn').click();

    const item = app.page.getByTestId('task-item').filter({ hasText: 'Checked task' });
    await item.getByTestId('task-complete-btn').click();

    // After completing, the complete button should be gone and a green ✓ appears
    await expect(item.getByTestId('task-complete-btn')).not.toBeVisible();
    await expect(item.locator('span.bg-green-500')).toBeVisible();
  });

  test('task item shows a relative timestamp', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-title-input').fill('Timestamped task');
    await app.page.getByTestId('task-submit-btn').click();

    const item = app.page.getByTestId('task-item').filter({ hasText: 'Timestamped task' });
    // Timestamp is rendered via formatDistanceToNow (e.g. "less than a minute ago")
    await expect(item).toContainText('ago');
  });

  test('submit button is disabled when the title input is empty', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await expect(app.page.getByTestId('task-submit-btn')).toBeDisabled();
  });

  test('submit button becomes enabled after typing a title', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-title-input').fill('Some task');

    await expect(app.page.getByTestId('task-submit-btn')).toBeEnabled();
  });

  test('clearing the title input disables the submit button again', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-title-input').fill('Temp');
    await expect(app.page.getByTestId('task-submit-btn')).toBeEnabled();

    await app.page.getByTestId('task-title-input').clear();
    await expect(app.page.getByTestId('task-submit-btn')).toBeDisabled();
  });

  test('filter bar "All" button has active styling by default', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    const allBtn = app.page.locator('[data-testid="task-filter-btn"][data-filter="all"]');
    await expect(allBtn).toHaveClass(/bg-bear-active/);
  });

  test('clicking "To Do" filter gives it active styling', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    const todoBtn = app.page.locator('[data-testid="task-filter-btn"][data-filter="todo"]');
    await todoBtn.click();

    await expect(todoBtn).toHaveClass(/bg-bear-active/);
    // "All" is no longer active
    await expect(
      app.page.locator('[data-testid="task-filter-btn"][data-filter="all"]')
    ).not.toHaveClass(/bg-bear-active/);
  });

  test('high priority task shows orange priority label', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push({
        id: 'adv-high-1',
        title: 'High Priority Task',
        status: 'todo',
        priority: 'high',
        note_id: null,
        agent_id: null,
        assigned_agent_id: null,
        due_date: null,
        created_at: now,
        updated_at: now,
      });
    });
    await app.goto();
    await app.navTasks.click();

    const item = app.page.getByTestId('task-item').filter({ hasText: 'High Priority Task' });
    // Priority label uses text-orange-400 for "high"
    await expect(item.locator('span.text-orange-400')).toBeVisible();
    await expect(item.locator('span.text-orange-400')).toHaveText('high');
  });

  test('urgent priority task shows red priority label', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.tasks.push({
        id: 'adv-urgent-1',
        title: 'Urgent Task',
        status: 'todo',
        priority: 'urgent',
        note_id: null,
        agent_id: null,
        assigned_agent_id: null,
        due_date: null,
        created_at: now,
        updated_at: now,
      });
    });
    await app.goto();
    await app.navTasks.click();

    const item = app.page.getByTestId('task-item').filter({ hasText: 'Urgent Task' });
    await expect(item.locator('span.text-red-500')).toBeVisible();
    await expect(item.locator('span.text-red-500')).toHaveText('urgent');
  });

  test('task group header shows status label with count', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    // Create two tasks so the "To Do (2)" header is rendered
    await app.page.getByTestId('task-title-input').fill('Task One');
    await app.page.getByTestId('task-submit-btn').click();
    await app.page.getByTestId('task-title-input').fill('Task Two');
    await app.page.getByTestId('task-submit-btn').click();

    const todoGroup = app.page.locator('[data-testid="task-group"][data-status="todo"]');
    await expect(todoGroup).toContainText('To Do');
    await expect(todoGroup).toContainText('2');
  });
});
