/**
 * TagTreeItem visual-state tests: bg-bear-active class on selected tag,
 * data-tag-path attribute, and pinned-tag SVG circle indicator.
 * Complements spec 36 (counts/expand) and spec 07 (pin/rename/delete ops)
 * — neither tests selection styling or the data attribute.
 */
import { test, expect } from '../fixtures';

test.describe('Tag Item Selected Style', () => {
  test('clicking a tag gives the tag-item bg-bear-active class', async ({ app }) => {
    await app.seed([{ title: 'Style Note', tags: ['active-tag'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'active-tag' }).click();

    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'active-tag' })
    ).toHaveClass(/bg-bear-active/);
  });

  test('unselected tag does not have bg-bear-active class', async ({ app }) => {
    await app.seed([{ title: 'Unselected Note', tags: ['plain-tag'] }]);
    await app.goto();

    // Do not click the tag — it should have no active class
    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'plain-tag' })
    ).not.toHaveClass(/bg-bear-active/);
  });

  test('tag-item has data-tag-path attribute set to the tag name', async ({ app }) => {
    await app.seed([{ title: 'Path Note', tags: ['path-tag'] }]);
    await app.goto();

    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'path-tag' })
    ).toHaveAttribute('data-tag-path', 'path-tag');
  });

  test('clicking All Notes after tag selection removes bg-bear-active from the tag', async ({ app }) => {
    await app.seed([{ title: 'Deselect Note', tags: ['deselect-tag'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'deselect-tag' }).click();
    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'deselect-tag' })
    ).toHaveClass(/bg-bear-active/);

    await app.navAllNotes.click();

    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'deselect-tag' })
    ).not.toHaveClass(/bg-bear-active/);
  });

  test('pinned tag shows an SVG circle pin indicator inside tag-item', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.tags.push({
        name: 'pinned-tag',
        parent_name: null,
        is_pinned: true,
      });
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.notes.push({
        id: 'pin-style-note',
        title: 'Pinned Tag Note',
        content: '',
        state: 'draft',
        is_pinned: false,
        deleted: false,
        word_count: 0,
        tags: ['pinned-tag'],
        workspace_id: null,
        created_at: now,
        updated_at: now,
        version: 1,
      });
    });
    await app.goto();

    const tagItem = app.tagTree.getByTestId('tag-item').filter({ hasText: 'pinned-tag' });
    // Pinned tags render an SVG circle before the tag name
    await expect(tagItem.locator('svg circle')).toBeVisible();
  });

  test('unpinned tag does not show an SVG circle pin indicator', async ({ app }) => {
    await app.seed([{ title: 'Unpinned Tag Note', tags: ['normal-tag'] }]);
    await app.goto();

    const tagItem = app.tagTree.getByTestId('tag-item').filter({ hasText: 'normal-tag' });
    await expect(tagItem.locator('svg circle')).not.toBeVisible();
  });

  test('selecting a second tag makes the first lose its bg-bear-active class', async ({ app }) => {
    await app.seed([
      { title: 'Note One', tags: ['tag-one'] },
      { title: 'Note Two', tags: ['tag-two'] },
    ]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'tag-one' }).click();
    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'tag-one' })
    ).toHaveClass(/bg-bear-active/);

    // Click a different tag (non-shift click clears previous selection)
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'tag-two' }).click();

    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'tag-one' })
    ).not.toHaveClass(/bg-bear-active/);
    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'tag-two' })
    ).toHaveClass(/bg-bear-active/);
  });
});
