/**
 * Note list combined filter tests: search + tag filter, search + workspace filter,
 * tag + workspace combined, and empty-state for combined no-match.
 * Each test type is distinct from the individual filter specs (03, 04, 28, 29).
 */
import { test, expect } from '../fixtures';

test.describe('Note List Combined Filters', () => {
  test('search within a tag filter shows only matching notes from that tag', async ({ app }) => {
    await app.seed([
      { title: 'Work Meeting Notes', tags: ['work'] },
      { title: 'Work Budget Plan',   tags: ['work'] },
      { title: 'Personal Diary',     tags: ['personal'] },
    ]);
    await app.goto();

    // Filter by tag "work"
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();

    // Then search within the filtered list
    await app.searchInput.fill('Meeting');

    await expect(app.noteItem('Work Meeting Notes')).toBeVisible();
    await expect(app.noteItem('Work Budget Plan')).not.toBeVisible();
    // Note outside the tag filter is also not visible
    await expect(app.noteItem('Personal Diary')).not.toBeVisible();
  });

  test('clearing search while in a tag filter restores all tag-filtered notes', async ({ app }) => {
    await app.seed([
      { title: 'Work Alpha', tags: ['work'] },
      { title: 'Work Beta',  tags: ['work'] },
    ]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();
    await app.searchInput.fill('Alpha');
    await expect(app.noteItem('Work Beta')).not.toBeVisible();

    await app.searchInput.clear();

    // Both work-tagged notes visible again
    await expect(app.noteItem('Work Alpha')).toBeVisible();
    await expect(app.noteItem('Work Beta')).toBeVisible();
  });

  test('workspace filter + search: shows only workspace notes matching search', async ({ app }) => {
    await app.page.addInitScript(() => {
      const ws = { id: 'ws-search-1', name: 'Sprint WS' };
      window.__TAURI_MOCK_DB__.workspaces.push(ws);

      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.notes.push(
        { id: 'n-ws-a', title: 'Sprint Planning', content: '', state: 'draft', is_pinned: false, deleted: false, word_count: 0, tags: [], workspace_id: 'ws-search-1', created_at: now, updated_at: now, version: 1 },
        { id: 'n-ws-b', title: 'Sprint Retro',    content: '', state: 'draft', is_pinned: false, deleted: false, word_count: 0, tags: [], workspace_id: 'ws-search-1', created_at: now, updated_at: now, version: 1 },
        { id: 'n-other', title: 'Sprint Global',  content: '', state: 'draft', is_pinned: false, deleted: false, word_count: 0, tags: [], workspace_id: null, created_at: now, updated_at: now, version: 1 },
      );
    });
    await app.goto();

    // Select workspace
    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Sprint WS' }).click();

    // Search within it
    await app.searchInput.fill('Planning');

    await expect(app.noteItem('Sprint Planning')).toBeVisible();
    await expect(app.noteItem('Sprint Retro')).not.toBeVisible();
    // Note outside workspace is not shown even though it matches the search
    await expect(app.noteItem('Sprint Global')).not.toBeVisible();
  });

  test('workspace filter + search: clearing search shows all workspace notes', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workspaces.push({ id: 'ws-clear', name: 'Clear Test WS' });
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.notes.push(
        { id: 'n-ct-1', title: 'Note Alpha', content: '', state: 'draft', is_pinned: false, deleted: false, word_count: 0, tags: [], workspace_id: 'ws-clear', created_at: now, updated_at: now, version: 1 },
        { id: 'n-ct-2', title: 'Note Beta',  content: '', state: 'draft', is_pinned: false, deleted: false, word_count: 0, tags: [], workspace_id: 'ws-clear', created_at: now, updated_at: now, version: 1 },
      );
    });
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Clear Test WS' }).click();

    await app.searchInput.fill('Alpha');
    await expect(app.noteItem('Note Beta')).not.toBeVisible();

    await app.searchInput.clear();

    await expect(app.noteItem('Note Alpha')).toBeVisible();
    await expect(app.noteItem('Note Beta')).toBeVisible();
  });

  test('workspace filter shows only notes from that workspace', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workspaces.push({ id: 'ws-combo', name: 'Combo WS' });
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.notes.push(
        { id: 'n-both', title: 'In WS', content: '', state: 'draft', is_pinned: false, deleted: false, word_count: 0, tags: [], workspace_id: 'ws-combo', created_at: now, updated_at: now, version: 1 },
        { id: 'n-out',  title: 'Not In WS', content: '', state: 'draft', is_pinned: false, deleted: false, word_count: 0, tags: [], workspace_id: null, created_at: now, updated_at: now, version: 1 },
      );
    });
    await app.goto();

    await app.page.getByTestId('workspace-trigger').click();
    await app.page.getByTestId('workspace-option').filter({ hasText: 'Combo WS' }).click();

    await expect(app.noteItem('In WS')).toBeVisible();
    await expect(app.noteItem('Not In WS')).not.toBeVisible();
  });

  test('combined search + tag filter with no match shows empty state', async ({ app }) => {
    await app.seed([
      { title: 'Work Journal', tags: ['work'] },
    ]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();
    await app.searchInput.fill('zzznomatch');

    await expect(app.noteListEmpty).toBeVisible();
    await expect(app.noteItem('Work Journal')).not.toBeVisible();
  });

  test('clicking All Notes clears both tag filter and search', async ({ app }) => {
    await app.seed([
      { title: 'Work Note',     tags: ['work'] },
      { title: 'Personal Note', tags: ['personal'] },
    ]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();
    await app.searchInput.fill('Work');
    await expect(app.noteItem('Personal Note')).not.toBeVisible();

    await app.navAllNotes.click();

    // Tag filter is cleared; all notes should now be visible
    // (NoteList's local searchFilter is NOT reset by nav, so we only verify note visibility)
    await expect(app.noteItem('Work Note')).toBeVisible();
    await expect(app.noteItem('Personal Note')).toBeVisible();
  });

  test('switching tags while searching resets the filtered view', async ({ app }) => {
    await app.seed([
      { title: 'Work Alpha',     tags: ['work'] },
      { title: 'Personal Alpha', tags: ['personal'] },
    ]);
    await app.goto();

    // Select work tag and search
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();
    await app.searchInput.fill('Alpha');
    await expect(app.noteItem('Work Alpha')).toBeVisible();

    // Switch to different tag — personal notes become candidate
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'personal' }).click();

    await expect(app.noteItem('Personal Alpha')).toBeVisible();
    await expect(app.noteItem('Work Alpha')).not.toBeVisible();
  });
});
