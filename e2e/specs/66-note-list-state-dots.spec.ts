/**
 * Note list state dot CSS color class tests, data-note-id attribute,
 * and "Untitled" placeholder for notes with no title.
 * Complements spec 43 (note item display) which tests span title= attribute
 * but not the actual Tailwind color classes.
 */
import { test, expect } from '../fixtures';

test.describe('Note List State Dots', () => {
  test('draft note state dot has bg-gray-400 class', async ({ app }) => {
    await app.seed([{ title: 'Draft Dot Note', state: 'draft' }]);
    await app.goto();

    const item = app.noteItem('Draft Dot Note');
    await expect(item.locator('span[title="draft"]')).toHaveClass(/bg-gray-400/);
  });

  test('review note state dot has bg-yellow-500 class', async ({ app }) => {
    await app.seed([{ title: 'Review Dot Note', state: 'review' }]);
    await app.goto();

    const item = app.noteItem('Review Dot Note');
    await expect(item.locator('span[title="review"]')).toHaveClass(/bg-yellow-500/);
  });

  test('published note state dot has bg-green-500 class', async ({ app }) => {
    await app.seed([{ title: 'Published Dot Note', state: 'published' }]);
    await app.goto();

    const item = app.noteItem('Published Dot Note');
    await expect(item.locator('span[title="published"]')).toHaveClass(/bg-green-500/);
  });

  test('draft dot does not have bg-green-500 class', async ({ app }) => {
    await app.seed([{ title: 'Not Green Draft', state: 'draft' }]);
    await app.goto();

    const item = app.noteItem('Not Green Draft');
    await expect(item.locator('span[title="draft"]')).not.toHaveClass(/bg-green-500/);
  });

  test('note item has data-note-id attribute matching the note id', async ({ app }) => {
    await app.seed([{ id: 'note-id-attr-test', title: 'ID Attr Note' }]);
    await app.goto();

    const item = app.noteItem('ID Attr Note');
    await expect(item).toHaveAttribute('data-note-id', 'note-id-attr-test');
  });

  test('note with empty title shows "Untitled" in the note list', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.notes.push({
        id: 'untitled-note-test',
        title: '',
        content: 'some content',
        state: 'draft',
        is_pinned: false,
        deleted: false,
        word_count: 2,
        tags: [],
        workspace_id: null,
        created_at: now,
        updated_at: now,
        version: 1,
      });
    });
    await app.goto();

    await expect(
      app.page.getByTestId('note-item').filter({ hasText: 'Untitled' }),
    ).toBeVisible();
  });

  test('state dot has rounded-full class (always circular)', async ({ app }) => {
    await app.seed([{ title: 'Circle Dot Note', state: 'draft' }]);
    await app.goto();

    const item = app.noteItem('Circle Dot Note');
    await expect(item.locator('span[title="draft"]')).toHaveClass(/rounded-full/);
  });

  test('note item for selected note has bg-bear-active class', async ({ app }) => {
    await app.seed([{ title: 'Selected Note' }]);
    await app.goto();

    await app.noteItem('Selected Note').click();

    await expect(app.noteItem('Selected Note')).toHaveClass(/bg-bear-active/);
  });
});
