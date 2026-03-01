/**
 * Note list sort-order tests: within unpinned notes the NoteList `sorted`
 * useMemo sorts by `updated_at` descending (most recently modified first).
 * Spec 43 only tests pin-first ordering; no spec verifies that a more recently
 * updated unpinned note appears before an older unpinned note.
 * Complements spec 43 (pinned-first ordering).
 */
import { test, expect } from '../fixtures';

test.describe('Note Sort Order by Updated At', () => {
  test('more recently updated note appears first among unpinned notes', async ({ app }) => {
    await app.page.addInitScript(() => {
      const older = new Date(Date.now() - 120_000).toISOString(); // 2 min ago
      const newer = new Date(Date.now() - 10_000).toISOString();  // 10 sec ago
      window.__TAURI_MOCK_DB__.notes.push(
        {
          id: 'sort-older',
          title: 'Older Updated Note',
          content: '',
          state: 'draft',
          is_pinned: false,
          deleted: false,
          word_count: 0,
          tags: [],
          workspace_id: null,
          created_at: older,
          updated_at: older,
          version: 1,
        },
        {
          id: 'sort-newer',
          title: 'Newer Updated Note',
          content: '',
          state: 'draft',
          is_pinned: false,
          deleted: false,
          word_count: 0,
          tags: [],
          workspace_id: null,
          created_at: newer,
          updated_at: newer,
          version: 1,
        },
      );
    });
    await app.goto();

    const items = app.page.getByTestId('note-item');
    await expect(items.first()).toContainText('Newer Updated Note');
    await expect(items.nth(1)).toContainText('Older Updated Note');
  });

  test('pinned note appears before both newer and older unpinned notes', async ({ app }) => {
    await app.page.addInitScript(() => {
      const oldest = new Date(Date.now() - 300_000).toISOString(); // 5 min ago
      const mid = new Date(Date.now() - 60_000).toISOString();     // 1 min ago
      const recent = new Date(Date.now() - 5_000).toISOString();   // 5 sec ago
      window.__TAURI_MOCK_DB__.notes.push(
        {
          id: 'sort-pin-oldest',
          title: 'Pinned Old Note',
          content: '',
          state: 'draft',
          is_pinned: true,
          deleted: false,
          word_count: 0,
          tags: [],
          workspace_id: null,
          created_at: oldest,
          updated_at: oldest,
          version: 1,
        },
        {
          id: 'sort-unpin-recent',
          title: 'Unpinned Recent Note',
          content: '',
          state: 'draft',
          is_pinned: false,
          deleted: false,
          word_count: 0,
          tags: [],
          workspace_id: null,
          created_at: recent,
          updated_at: recent,
          version: 1,
        },
        {
          id: 'sort-unpin-mid',
          title: 'Unpinned Mid Note',
          content: '',
          state: 'draft',
          is_pinned: false,
          deleted: false,
          word_count: 0,
          tags: [],
          workspace_id: null,
          created_at: mid,
          updated_at: mid,
          version: 1,
        },
      );
    });
    await app.goto();

    const items = app.page.getByTestId('note-item');
    // Pinned note (oldest timestamp) still comes first
    await expect(items.first()).toContainText('Pinned Old Note');
    // Among unpinned: recent before mid
    await expect(items.nth(1)).toContainText('Unpinned Recent Note');
    await expect(items.nth(2)).toContainText('Unpinned Mid Note');
  });

  test('updating a note moves it to the top of the unpinned list', async ({ app }) => {
    await app.seed([
      { title: 'First Created Note' },
      { title: 'Second Created Note' },
    ]);
    await app.goto();

    // Click the older note (Second Created Note appears below First, assuming same-timestamp
    // ties are stable, but let us click the first note to ensure Second appears after)
    // Instead: click Second Created Note and edit it — it should jump to top
    await app.noteItem('Second Created Note').click();
    await app.page.getByTestId('note-title-input').fill('Second Created Note Updated');

    // After saving (auto-save fires on title change), the updated note should be first
    await expect(app.page.getByTestId('note-item').first()).toContainText('Second Created Note Updated');
  });

  test('three notes are listed newest-first when all are unpinned', async ({ app }) => {
    await app.page.addInitScript(() => {
      const t1 = new Date(Date.now() - 180_000).toISOString(); // oldest
      const t2 = new Date(Date.now() - 90_000).toISOString();  // middle
      const t3 = new Date(Date.now() - 30_000).toISOString();  // newest
      [
        { id: 's1', title: 'Sort Note A', updated_at: t1 },
        { id: 's2', title: 'Sort Note B', updated_at: t2 },
        { id: 's3', title: 'Sort Note C', updated_at: t3 },
      ].forEach((n) => {
        window.__TAURI_MOCK_DB__.notes.push({
          id: n.id,
          title: n.title,
          content: '',
          state: 'draft',
          is_pinned: false,
          deleted: false,
          word_count: 0,
          tags: [],
          workspace_id: null,
          created_at: n.updated_at,
          updated_at: n.updated_at,
          version: 1,
        });
      });
    });
    await app.goto();

    const items = app.page.getByTestId('note-item');
    await expect(items.first()).toContainText('Sort Note C');
    await expect(items.nth(1)).toContainText('Sort Note B');
    await expect(items.nth(2)).toContainText('Sort Note A');
  });
});
