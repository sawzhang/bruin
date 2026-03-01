/**
 * Tag note count display and hierarchy expand/collapse behavior
 */
import { test, expect } from '../fixtures';

test.describe('Tag Counts and Hierarchy', () => {
  test('tag item shows the number of notes with that tag', async ({ app }) => {
    await app.seed([
      { title: 'Note One', tags: ['dev'] },
      { title: 'Note Two', tags: ['dev'] },
      { title: 'Note Three', tags: ['design'] },
    ]);
    await app.goto();

    const devTag = app.tagTree.getByTestId('tag-item').filter({ hasText: 'dev' });
    // Tag shows count "2" next to the name
    await expect(devTag).toContainText('2');

    const designTag = app.tagTree.getByTestId('tag-item').filter({ hasText: 'design' });
    await expect(designTag).toContainText('1');
  });

  test('hierarchical tag shows parent with expand arrow', async ({ app }) => {
    await app.seed([{ title: 'Deep Note', tags: ['work/projects'] }]);
    await app.goto();

    // Parent tag "work" should be visible and have an expand arrow (▼)
    const workTag = app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' });
    await expect(workTag).toBeVisible();
    await expect(workTag).toContainText('▼');
  });

  test('child tag is visible by default (expanded=true)', async ({ app }) => {
    await app.seed([{ title: 'Child Note', tags: ['project/frontend'] }]);
    await app.goto();

    // Child tag "frontend" should be visible under "project"
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'frontend' })).toBeVisible();
  });

  test('clicking expand arrow collapses the child tags', async ({ app }) => {
    await app.seed([{ title: 'Collapse Me', tags: ['parent/child'] }]);
    await app.goto();

    const parentTag = app.tagTree.getByTestId('tag-item').filter({ hasText: 'parent' });
    await expect(parentTag).toBeVisible();

    // Click the expand arrow (▼) to collapse
    await parentTag.locator('span').filter({ hasText: '▼' }).click();

    // Child tag should now be hidden
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'child' })).not.toBeVisible();
  });

  test('clicking expand arrow again re-expands the child tags', async ({ app }) => {
    await app.seed([{ title: 'Re-expand Me', tags: ['outer/inner'] }]);
    await app.goto();

    const outerTag = app.tagTree.getByTestId('tag-item').filter({ hasText: 'outer' });

    // Collapse
    await outerTag.locator('span').filter({ hasText: '▼' }).click();
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'inner' })).not.toBeVisible();

    // Re-expand (arrow now shows ▶)
    await outerTag.locator('span').filter({ hasText: '▶' }).click();
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'inner' })).toBeVisible();
  });

  test('leaf tag (no children) has no expand arrow', async ({ app }) => {
    await app.seed([{ title: 'Simple Note', tags: ['simple'] }]);
    await app.goto();

    const simpleTag = app.tagTree.getByTestId('tag-item').filter({ hasText: 'simple' });
    // No expand arrow for leaf tags
    await expect(simpleTag.locator('span').filter({ hasText: '▼' })).not.toBeVisible();
    await expect(simpleTag.locator('span').filter({ hasText: '▶' })).not.toBeVisible();
  });
});
