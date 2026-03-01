/**
 * Tag tree text content and hierarchical data-tag-path tests:
 * - spec 04 calls toBeVisible() on tag-tree-empty but never asserts its text
 *   ("No tags yet")
 * - spec 78 tests data-tag-path for a simple leaf tag, but never for a child
 *   tag whose fullPath is "parent/child" (the hierarchical full path)
 * - spec 36 uses toContainText() on the whole tag item for the note count,
 *   but never isolates the count span text with toHaveText()
 * Complements spec 04, spec 36, and spec 78.
 */
import { test, expect } from '../fixtures';

test.describe('Tag Tree Text and Hierarchy Path', () => {
  test('tag-tree-empty has text "No tags yet"', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('tag-tree-empty')).toHaveText('No tags yet');
  });

  test('tag-tree-empty disappears once a note with a tag is seeded', async ({ app }) => {
    await app.seed([{ title: 'Tagged Note', tags: ['mytag'] }]);
    await app.goto();

    await expect(app.page.getByTestId('tag-tree-empty')).not.toBeVisible();
    await expect(app.page.getByTestId('tag-tree')).toBeVisible();
  });

  test('child tag data-tag-path is the full hierarchical path "parent/child"', async ({ app }) => {
    await app.seed([{ title: 'Hierarchy Note', tags: ['project/frontend'] }]);
    await app.goto();

    // The child item "frontend" has fullPath = "project/frontend"
    const childItem = app.tagTree.getByTestId('tag-item').filter({ hasText: 'frontend' });
    await expect(childItem).toHaveAttribute('data-tag-path', 'project/frontend');
  });

  test('parent tag data-tag-path is just the parent segment', async ({ app }) => {
    await app.seed([{ title: 'Parent Path Note', tags: ['team/backend'] }]);
    await app.goto();

    // The parent item "team" has fullPath = "team"
    const parentItem = app.tagTree
      .getByTestId('tag-item')
      .filter({ hasText: 'team' })
      .first();
    await expect(parentItem).toHaveAttribute('data-tag-path', 'team');
  });

  test('deeply nested tag has its full path in data-tag-path', async ({ app }) => {
    await app.seed([{ title: 'Deep Hierarchy Note', tags: ['org/team/project'] }]);
    await app.goto();

    // The deepest child "project" has fullPath = "org/team/project"
    const deepItem = app.tagTree.getByTestId('tag-item').filter({ hasText: 'project' });
    await expect(deepItem).toHaveAttribute('data-tag-path', 'org/team/project');
  });

  test('tag note count span shows the exact count as text', async ({ app }) => {
    await app.seed([
      { title: 'Count Note 1', tags: ['counter'] },
      { title: 'Count Note 2', tags: ['counter'] },
      { title: 'Count Note 3', tags: ['counter'] },
    ]);
    await app.goto();

    const tagItem = app.tagTree.getByTestId('tag-item').filter({ hasText: 'counter' });
    // The note count is rendered in the last span of the tag item
    await expect(tagItem.locator('span').last()).toHaveText('3');
  });

  test('tag note count updates to 1 when only one note has the tag', async ({ app }) => {
    await app.seed([{ title: 'Single Count Note', tags: ['solo'] }]);
    await app.goto();

    const tagItem = app.tagTree.getByTestId('tag-item').filter({ hasText: 'solo' });
    await expect(tagItem.locator('span').last()).toHaveText('1');
  });
});
