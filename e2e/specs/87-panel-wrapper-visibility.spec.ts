/**
 * Panel wrapper conditional-rendering tests: task-panel-wrapper and
 * activity-panel-wrapper are added to / removed from the DOM when their
 * respective panels are opened and closed.
 * Complements spec 09 (activity content) and spec 11 (task CRUD)
 * — neither tests the wrapper elements or their conditional rendering.
 */
import { test, expect } from '../fixtures';

test.describe('Panel Wrapper Visibility', () => {
  test('task-panel-wrapper is not visible before task panel is opened', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('task-panel-wrapper')).not.toBeVisible();
  });

  test('task-panel-wrapper is visible after nav-tasks is clicked', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-tasks').click();

    await expect(app.page.getByTestId('task-panel-wrapper')).toBeVisible();
  });

  test('task-panel-wrapper disappears after nav-tasks is toggled off', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-tasks').click();
    await expect(app.page.getByTestId('task-panel-wrapper')).toBeVisible();

    await app.page.getByTestId('nav-tasks').click();

    await expect(app.page.getByTestId('task-panel-wrapper')).not.toBeVisible();
  });

  test('activity-panel-wrapper is not visible before activity panel is opened', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('activity-panel-wrapper')).not.toBeVisible();
  });

  test('activity-panel-wrapper is visible after nav-activity is clicked', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-activity').click();

    await expect(app.page.getByTestId('activity-panel-wrapper')).toBeVisible();
  });

  test('activity-panel-wrapper disappears after nav-activity is toggled off', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-activity').click();
    await expect(app.page.getByTestId('activity-panel-wrapper')).toBeVisible();

    await app.page.getByTestId('nav-activity').click();

    await expect(app.page.getByTestId('activity-panel-wrapper')).not.toBeVisible();
  });

  test('sidebar-wrapper is visible on app load', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('sidebar-wrapper')).toBeVisible();
  });

  test('editor-wrapper is visible on app load', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('editor-wrapper')).toBeVisible();
  });
});
