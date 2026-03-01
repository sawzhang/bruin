/**
 * Workspace option detail tests: workspace-option data-workspace-id attribute,
 * workspace-name-input placeholder, and workspace-dropdown close after selection.
 * Complements spec 05 (creation/switching) and spec 61 (extras/styling)
 * — neither tests data-workspace-id or the workspace-name-input placeholder.
 */
import { test, expect } from '../fixtures';

async function openDropdown(app: import('../page-objects/AppPage').AppPage) {
  await app.page.getByTestId('workspace-trigger').click();
  await expect(app.page.getByTestId('workspace-dropdown')).toBeVisible();
}

test.describe('Workspace Option Detail', () => {
  test('workspace-option has data-workspace-id attribute', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workspaces.push({
        id: 'ws-attr-test-id',
        name: 'Attr Test WS',
        created_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await openDropdown(app);

    const option = app.page.getByTestId('workspace-option').filter({ hasText: 'Attr Test WS' });
    await expect(option).toHaveAttribute('data-workspace-id', 'ws-attr-test-id');
  });

  test('workspace-name-input has placeholder "Workspace name"', async ({ app }) => {
    await app.goto();
    await openDropdown(app);
    await app.page.getByTestId('workspace-new-btn').click();

    await expect(app.page.getByTestId('workspace-name-input')).toHaveAttribute(
      'placeholder',
      'Workspace name',
    );
  });

  test('workspace-dropdown closes after selecting a workspace', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workspaces.push({
        id: 'ws-close-test',
        name: 'Close On Select WS',
        created_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await openDropdown(app);

    await app.page.getByTestId('workspace-option').filter({ hasText: 'Close On Select WS' }).click();

    await expect(app.page.getByTestId('workspace-dropdown')).not.toBeVisible();
  });

  test('workspace-dropdown closes after selecting workspace-option-all', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workspaces.push({
        id: 'ws-all-close',
        name: 'Some WS',
        created_at: new Date().toISOString(),
      });
    });
    await app.goto();
    // First select a workspace so "All Workspaces" can deselect it
    await openDropdown(app);
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Some WS' }).click();
    // Now reopen and click All Workspaces
    await openDropdown(app);
    await app.page.getByTestId('workspace-option-all').click();

    await expect(app.page.getByTestId('workspace-dropdown')).not.toBeVisible();
  });

  test('workspace-name-input is visible after clicking workspace-new-btn', async ({ app }) => {
    await app.goto();
    await openDropdown(app);
    await app.page.getByTestId('workspace-new-btn').click();

    await expect(app.page.getByTestId('workspace-name-input')).toBeVisible();
  });

  test('workspace-create-btn label is "Add"', async ({ app }) => {
    await app.goto();
    await openDropdown(app);
    await app.page.getByTestId('workspace-new-btn').click();

    await expect(app.page.getByTestId('workspace-create-btn')).toHaveText('Add');
  });

  test('pressing Escape in workspace-name-input hides it', async ({ app }) => {
    await app.goto();
    await openDropdown(app);
    await app.page.getByTestId('workspace-new-btn').click();
    await expect(app.page.getByTestId('workspace-name-input')).toBeVisible();

    await app.page.getByTestId('workspace-name-input').press('Escape');

    await expect(app.page.getByTestId('workspace-name-input')).not.toBeVisible();
    // The "New Workspace" button should reappear
    await expect(app.page.getByTestId('workspace-new-btn')).toBeVisible();
  });
});
