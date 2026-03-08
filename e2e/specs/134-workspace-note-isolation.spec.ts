/**
 * Workspace note isolation tests: workspace filtering, unassigned notes,
 * and workspace assignment on creation.
 * Verifies that selecting a workspace filters the note list correctly
 * and that notes without workspace_id only appear in "All Workspaces".
 */
import { test, expect } from '../fixtures';

test.describe('Workspace Note Isolation', () => {
  test('default "All Workspaces" shows all notes regardless of workspace_id', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.workspaces.push(
        { id: 'ws-1', name: 'Work', created_at: now, updated_at: now },
        { id: 'ws-2', name: 'Personal', created_at: now, updated_at: now },
      );
      window.__TAURI_MOCK_DB__.notes.push(
        {
          id: 'n-work', title: 'Work Note', content: 'work stuff', state: 'draft',
          is_pinned: false, deleted: false, word_count: 2, tags: [],
          workspace_id: 'ws-1', created_at: now, updated_at: now, version: 1,
        },
        {
          id: 'n-personal', title: 'Personal Note', content: 'personal stuff', state: 'draft',
          is_pinned: false, deleted: false, word_count: 2, tags: [],
          workspace_id: 'ws-2', created_at: now, updated_at: now, version: 1,
        },
        {
          id: 'n-unassigned', title: 'Unassigned Note', content: 'no workspace', state: 'draft',
          is_pinned: false, deleted: false, word_count: 2, tags: [],
          workspace_id: null, created_at: now, updated_at: now, version: 1,
        },
      );
    });
    await app.goto();

    // Default view should show all three notes
    await expect(app.noteItem('Work Note')).toBeVisible();
    await expect(app.noteItem('Personal Note')).toBeVisible();
    await expect(app.noteItem('Unassigned Note')).toBeVisible();
  });

  test('selecting a workspace filters to only that workspace notes', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.workspaces.push(
        { id: 'ws-1', name: 'Work', created_at: now, updated_at: now },
        { id: 'ws-2', name: 'Personal', created_at: now, updated_at: now },
      );
      window.__TAURI_MOCK_DB__.notes.push(
        {
          id: 'n-work-1', title: 'Work Task A', content: '', state: 'draft',
          is_pinned: false, deleted: false, word_count: 0, tags: [],
          workspace_id: 'ws-1', created_at: now, updated_at: now, version: 1,
        },
        {
          id: 'n-work-2', title: 'Work Task B', content: '', state: 'draft',
          is_pinned: false, deleted: false, word_count: 0, tags: [],
          workspace_id: 'ws-1', created_at: now, updated_at: now, version: 1,
        },
        {
          id: 'n-personal', title: 'Personal Diary', content: '', state: 'draft',
          is_pinned: false, deleted: false, word_count: 0, tags: [],
          workspace_id: 'ws-2', created_at: now, updated_at: now, version: 1,
        },
      );
    });
    await app.goto();

    // Select "Work" workspace
    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Work' }).click();

    // Only Work notes visible
    await expect(app.noteItem('Work Task A')).toBeVisible();
    await expect(app.noteItem('Work Task B')).toBeVisible();
    await expect(app.noteItem('Personal Diary')).not.toBeVisible();
  });

  test('notes without workspace_id appear only in "All Workspaces"', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.workspaces.push(
        { id: 'ws-1', name: 'Project Alpha', created_at: now, updated_at: now },
      );
      window.__TAURI_MOCK_DB__.notes.push(
        {
          id: 'n-assigned', title: 'Assigned Note', content: '', state: 'draft',
          is_pinned: false, deleted: false, word_count: 0, tags: [],
          workspace_id: 'ws-1', created_at: now, updated_at: now, version: 1,
        },
        {
          id: 'n-orphan', title: 'Orphan Note', content: 'no workspace', state: 'draft',
          is_pinned: false, deleted: false, word_count: 0, tags: [],
          workspace_id: null, created_at: now, updated_at: now, version: 1,
        },
      );
    });
    await app.goto();

    // Both visible in All Workspaces
    await expect(app.noteItem('Assigned Note')).toBeVisible();
    await expect(app.noteItem('Orphan Note')).toBeVisible();

    // Select Project Alpha workspace
    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Project Alpha' }).click();

    // Only assigned note visible; orphan is hidden
    await expect(app.noteItem('Assigned Note')).toBeVisible();
    await expect(app.noteItem('Orphan Note')).not.toBeVisible();
  });

  test('switching back to "All Workspaces" shows all notes again', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.workspaces.push(
        { id: 'ws-1', name: 'Filtered WS', created_at: now, updated_at: now },
      );
      window.__TAURI_MOCK_DB__.notes.push(
        {
          id: 'n-in-ws', title: 'Inside WS', content: '', state: 'draft',
          is_pinned: false, deleted: false, word_count: 0, tags: [],
          workspace_id: 'ws-1', created_at: now, updated_at: now, version: 1,
        },
        {
          id: 'n-outside', title: 'Outside WS', content: '', state: 'draft',
          is_pinned: false, deleted: false, word_count: 0, tags: [],
          workspace_id: null, created_at: now, updated_at: now, version: 1,
        },
      );
    });
    await app.goto();

    // Filter to workspace
    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Filtered WS' }).click();
    await expect(app.noteItem('Outside WS')).not.toBeVisible();

    // Switch back to All Workspaces
    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option-all').click();

    await expect(app.noteItem('Inside WS')).toBeVisible();
    await expect(app.noteItem('Outside WS')).toBeVisible();
  });
});
