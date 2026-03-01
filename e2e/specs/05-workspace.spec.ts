/**
 * Workspace management tests
 */
import { test, expect } from '../fixtures';

test.describe('Workspaces', () => {
  test('workspace selector is visible in sidebar', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('workspace-selector')).toBeVisible();
  });

  test('clicking workspace trigger opens dropdown', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();

    await expect(app.page.getByTestId('workspace-dropdown')).toBeVisible();
  });

  test('dropdown contains All Workspaces option by default', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();

    await expect(app.page.getByTestId('workspace-option-all')).toBeVisible();
  });

  test('creates a new workspace', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-new-btn').click();
    await app.page.getByTestId('workspace-name-input').fill('My Project');
    await app.page.getByTestId('workspace-create-btn').click();

    // Dropdown stays open after creation — new workspace is visible directly
    await expect(
      app.page.getByTestId('workspace-option').filter({ hasText: 'My Project' })
    ).toBeVisible();
  });

  test('creates workspace with Enter key', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-new-btn').click();
    await app.page.getByTestId('workspace-name-input').fill('Keyboard Workspace');
    await app.page.keyboard.press('Enter');

    // Dropdown stays open after creation
    await expect(
      app.page.getByTestId('workspace-option').filter({ hasText: 'Keyboard Workspace' })
    ).toBeVisible();
  });

  test('pressing Escape cancels workspace creation', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-new-btn').click();
    await app.page.getByTestId('workspace-name-input').fill('Should Not Create');
    await app.page.keyboard.press('Escape');

    // Input should disappear, new-btn should be back
    await expect(app.page.getByTestId('workspace-new-btn')).toBeVisible();
    await expect(app.page.getByTestId('workspace-name-input')).not.toBeVisible();
  });

  test('switching workspace updates the trigger label', async ({ app }) => {
    await app.goto();

    // Create workspace (dropdown stays open)
    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-new-btn').click();
    await app.page.getByTestId('workspace-name-input').fill('Switch Target');
    await app.page.getByTestId('workspace-create-btn').click();

    // Click the new option to switch (dropdown is still open)
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Switch Target' }).click();

    await expect(app.page.getByTestId('workspace-trigger')).toContainText('Switch Target');
  });
});
