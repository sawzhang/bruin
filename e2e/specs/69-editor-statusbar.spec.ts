/**
 * Editor status bar tests: editor-statusbar visibility, word count singular/plural,
 * and note-state-badge CSS color classes (complements spec 21 which tests badge text).
 */
import { test, expect } from '../fixtures';

test.describe('Editor Statusbar', () => {
  test('editor-statusbar is visible when a note is open', async ({ app }) => {
    await app.seed([{ title: 'Statusbar Note' }]);
    await app.goto();

    await app.noteItem('Statusbar Note').click();

    await expect(app.page.getByTestId('editor-statusbar')).toBeVisible();
  });

  test('editor-word-count shows "0 words" for a note with no content', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.notes.push({
        id: 'wc-zero', title: 'Zero Words', content: '', state: 'draft',
        is_pinned: false, deleted: false, word_count: 0, tags: [],
        workspace_id: null, created_at: now, updated_at: now, version: 1,
      });
    });
    await app.goto();

    await app.noteItem('Zero Words').click();

    await expect(app.page.getByTestId('editor-word-count')).toHaveText('0 words');
  });

  test('editor-word-count shows "1 word" (singular) for a one-word note', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.notes.push({
        id: 'wc-one', title: 'One Word', content: 'Hello', state: 'draft',
        is_pinned: false, deleted: false, word_count: 1, tags: [],
        workspace_id: null, created_at: now, updated_at: now, version: 1,
      });
    });
    await app.goto();

    await app.noteItem('One Word').click();

    await expect(app.page.getByTestId('editor-word-count')).toHaveText('1 word');
  });

  test('editor-word-count shows "5 words" (plural) for a multi-word note', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.notes.push({
        id: 'wc-many', title: 'Many Words', content: 'One two three four five', state: 'draft',
        is_pinned: false, deleted: false, word_count: 5, tags: [],
        workspace_id: null, created_at: now, updated_at: now, version: 1,
      });
    });
    await app.goto();

    await app.noteItem('Many Words').click();

    await expect(app.page.getByTestId('editor-word-count')).toHaveText('5 words');
  });

  test('editor-statusbar is not visible when no note is selected', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('editor-statusbar')).not.toBeVisible();
  });

  test('note-state-badge has bg-gray-400 class for a draft note', async ({ app }) => {
    await app.seed([{ title: 'Draft Badge Note', state: 'draft' }]);
    await app.goto();

    await app.noteItem('Draft Badge Note').click();

    await expect(app.page.getByTestId('note-state-badge')).toHaveClass(/bg-gray-400/);
  });

  test('note-state-badge has bg-yellow-500 class for a review note', async ({ app }) => {
    await app.seed([{ title: 'Review Badge Note', state: 'review' }]);
    await app.goto();

    await app.noteItem('Review Badge Note').click();

    await expect(app.page.getByTestId('note-state-badge')).toHaveClass(/bg-yellow-500/);
  });

  test('note-state-badge has bg-green-500 class for a published note', async ({ app }) => {
    await app.seed([{ title: 'Published Badge Note', state: 'published' }]);
    await app.goto();

    await app.noteItem('Published Badge Note').click();

    await expect(app.page.getByTestId('note-state-badge')).toHaveClass(/bg-green-500/);
  });
});
