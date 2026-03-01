/**
 * Workspace selector extra tests: trigger toggle, button labels, accent styling
 * on selected options, and dropdown close behavior.
 * Complements spec 05 (workspace CRUD) and spec 28 (workspace note filtering).
 */
import { test, expect } from '../fixtures';

test.describe('Workspace Selector Extras', () => {
  test('workspace trigger shows "All Workspaces" by default', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('workspace-trigger')).toContainText('All Workspaces');
  });

  test('clicking the trigger a second time closes the dropdown', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();
    await expect(app.page.getByTestId('workspace-dropdown')).toBeVisible();

    await app.page.getByTestId('workspace-trigger').click();

    await expect(app.page.getByTestId('workspace-dropdown')).not.toBeVisible();
  });

  test('workspace-new-btn label is "+ New Workspace"', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();

    await expect(app.page.getByTestId('workspace-new-btn')).toHaveText('+ New Workspace');
  });

  test('workspace-create-btn label is "Add"', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-new-btn').click();

    await expect(app.page.getByTestId('workspace-create-btn')).toHaveText('Add');
  });

  test('seeded workspace appears in dropdown without manual creation', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workspaces.push({ id: 'ws-seeded-1', name: 'Pre-seeded WS' });
    });
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();

    await expect(
      app.page.getByTestId('workspace-option').filter({ hasText: 'Pre-seeded WS' }),
    ).toBeVisible();
  });

  test('"All Workspaces" option has accent styling when no workspace is selected', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();

    // workspace-option-all gets text-bear-accent font-medium when currentWorkspaceId is null
    await expect(app.page.getByTestId('workspace-option-all')).toHaveClass(/text-bear-accent/);
  });

  test('selected workspace option gets accent styling', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workspaces.push({ id: 'ws-accent', name: 'Accent WS' });
    });
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Accent WS' }).click();

    // Re-open to check styling
    await app.page.getByTestId('workspace-trigger').click();

    const option = app.page.getByTestId('workspace-option').filter({ hasText: 'Accent WS' });
    await expect(option).toHaveClass(/text-bear-accent/);
  });

  test('"All Workspaces" option loses accent styling once a workspace is selected', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workspaces.push({ id: 'ws-deselect', name: 'Deselect WS' });
    });
    await app.goto();

    // Select a workspace
    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Deselect WS' }).click();

    // Re-open — "All Workspaces" should no longer have accent styling
    await app.page.getByTestId('workspace-trigger').click();

    await expect(app.page.getByTestId('workspace-option-all')).not.toHaveClass(/text-bear-accent/);
  });

  test('multiple seeded workspaces all appear as workspace-option items', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workspaces.push(
        { id: 'ws-m1', name: 'Work WS' },
        { id: 'ws-m2', name: 'Personal WS' },
        { id: 'ws-m3', name: 'Research WS' },
      );
    });
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();

    await expect(app.page.getByTestId('workspace-option')).toHaveCount(3);
  });
});
