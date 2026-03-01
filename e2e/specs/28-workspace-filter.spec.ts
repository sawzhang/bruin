/**
 * Workspace note filtering tests: selecting a workspace filters the note list
 */
import { test, expect } from '../fixtures';

test.describe('Workspace Filter', () => {
  test('selecting a workspace shows only its notes', async ({ app }) => {
    await app.page.addInitScript(() => {
      const ws = { id: 'ws-test-1', name: 'Project Alpha' };
      window.__TAURI_MOCK_DB__.workspaces.push(ws);

      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.notes.push(
        {
          id: 'n-ws', title: 'Workspace Note', content: '', state: 'draft',
          is_pinned: false, deleted: false, word_count: 0, tags: [],
          workspace_id: 'ws-test-1', created_at: now, updated_at: now, version: 1,
        },
        {
          id: 'n-no-ws', title: 'Global Note', content: '', state: 'draft',
          is_pinned: false, deleted: false, word_count: 0, tags: [],
          workspace_id: null, created_at: now, updated_at: now, version: 1,
        },
      );
    });
    await app.goto();

    // Select workspace from dropdown
    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Project Alpha' }).click();

    // Only the workspace note should be visible
    await expect(app.noteItem('Workspace Note')).toBeVisible();
    await expect(app.noteItem('Global Note')).not.toBeVisible();
  });

  test('switching back to All Workspaces shows all notes', async ({ app }) => {
    await app.page.addInitScript(() => {
      const ws = { id: 'ws-test-2', name: 'Project Beta' };
      window.__TAURI_MOCK_DB__.workspaces.push(ws);

      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.notes.push(
        {
          id: 'n-ws2', title: 'Beta Note', content: '', state: 'draft',
          is_pinned: false, deleted: false, word_count: 0, tags: [],
          workspace_id: 'ws-test-2', created_at: now, updated_at: now, version: 1,
        },
        {
          id: 'n-global2', title: 'No Workspace Note', content: '', state: 'draft',
          is_pinned: false, deleted: false, word_count: 0, tags: [],
          workspace_id: null, created_at: now, updated_at: now, version: 1,
        },
      );
    });
    await app.goto();

    // Filter to workspace
    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Project Beta' }).click();
    await expect(app.noteItem('No Workspace Note')).not.toBeVisible();

    // Switch back to All Workspaces
    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option-all').click();

    await expect(app.noteItem('Beta Note')).toBeVisible();
    await expect(app.noteItem('No Workspace Note')).toBeVisible();
  });

  test('trigger label updates when workspace is selected', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workspaces.push({ id: 'ws-label', name: 'Label Test WS' });
    });
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Label Test WS' }).click();

    await expect(app.page.getByTestId('workspace-trigger')).toContainText('Label Test WS');
  });
});
