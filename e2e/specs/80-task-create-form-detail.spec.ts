/**
 * TaskCreateForm detail tests: priority select options and defaults,
 * input placeholder, submit button label, and medium/low priority colour display.
 * Complements spec 51 (tests high/urgent priority colours, submit disabled/enabled)
 * and spec 11 (basic task CRUD) — neither tests the select options or default priority.
 */
import { test, expect } from '../fixtures';

test.describe('Task Create Form Detail', () => {
  test('task-priority-select is visible when the task panel is open', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await expect(app.page.getByTestId('task-priority-select')).toBeVisible();
  });

  test('task-priority-select default value is "medium"', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await expect(app.page.getByTestId('task-priority-select')).toHaveValue('medium');
  });

  test('task-priority-select has exactly 4 options', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await expect(app.page.getByTestId('task-priority-select').locator('option')).toHaveCount(4);
  });

  test('priority select option labels are Low, Med, High, Urgent', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await expect(app.page.getByTestId('task-priority-select').locator('option')).toHaveText([
      'Low',
      'Med',
      'High',
      'Urgent',
    ]);
  });

  test('changing priority to "low" updates the select value', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-priority-select').selectOption('low');

    await expect(app.page.getByTestId('task-priority-select')).toHaveValue('low');
  });

  test('task-title-input has placeholder "Add a task..."', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await expect(app.page.getByTestId('task-title-input')).toHaveAttribute(
      'placeholder',
      'Add a task...',
    );
  });

  test('task-submit-btn label is "Add"', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await expect(app.page.getByTestId('task-submit-btn')).toHaveText('Add');
  });

  test('task created with default priority shows text-blue-400 "medium" label', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-title-input').fill('Medium Priority Task');
    await app.page.getByTestId('task-submit-btn').click();

    const item = app.page.getByTestId('task-item').filter({ hasText: 'Medium Priority Task' });
    await expect(item.locator('span.text-blue-400')).toHaveText('medium');
  });

  test('task created with "low" priority shows text-gray-400 "low" label', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-priority-select').selectOption('low');
    await app.page.getByTestId('task-title-input').fill('Low Priority Task');
    await app.page.getByTestId('task-submit-btn').click();

    const item = app.page.getByTestId('task-item').filter({ hasText: 'Low Priority Task' });
    await expect(item.locator('span.text-gray-400')).toHaveText('low');
  });

  test('priority resets to "medium" after task creation', async ({ app }) => {
    await app.goto();
    await app.navTasks.click();

    await app.page.getByTestId('task-priority-select').selectOption('urgent');
    await app.page.getByTestId('task-title-input').fill('One-off Urgent Task');
    await app.page.getByTestId('task-submit-btn').click();

    // After submission, the select should reset to "medium"
    await expect(app.page.getByTestId('task-priority-select')).toHaveValue('medium');
  });
});
