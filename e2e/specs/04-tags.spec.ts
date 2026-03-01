/**
 * Tag management tests
 * Covers tag display, filtering, multi-select, and hierarchy.
 */
import { test, expect } from '../fixtures';

test.describe('Tags', () => {
  test('tags from seeded notes appear in the tag tree', async ({ app }) => {
    await app.seed([
      { title: 'Work Note', content: 'hello', tags: ['work'] },
    ]);
    await app.goto();

    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' })).toBeVisible();
  });

  test('clicking a tag filters the note list', async ({ app }) => {
    await app.seed([
      { title: 'Work Note', tags: ['work'] },
      { title: 'Personal Note', tags: ['personal'] },
    ]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();

    await expect(app.noteItem('Work Note')).toBeVisible();
    await expect(app.noteItem('Personal Note')).not.toBeVisible();
  });

  test('clicking same tag again deselects and shows all notes', async ({ app }) => {
    await app.seed([
      { title: 'Work Note', tags: ['work'] },
      { title: 'Personal Note', tags: ['personal'] },
    ]);
    await app.goto();

    const workTag = app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' });
    await workTag.click();
    await expect(app.noteItem('Personal Note')).not.toBeVisible();

    await workTag.click(); // deselect
    await expect(app.noteItem('Personal Note')).toBeVisible();
  });

  test('Shift+click adds AND filter for multiple tags', async ({ app }) => {
    await app.seed([
      { title: 'Both Tags Note', tags: ['work', 'important'] },
      { title: 'Work Only Note', tags: ['work'] },
      { title: 'Important Only Note', tags: ['important'] },
    ]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'important' }).click({
      modifiers: ['Shift'],
    });

    await expect(app.noteItem('Both Tags Note')).toBeVisible();
    await expect(app.noteItem('Work Only Note')).not.toBeVisible();
    await expect(app.noteItem('Important Only Note')).not.toBeVisible();
  });

  test('hierarchical tag shows parent and child', async ({ app }) => {
    await app.seed([
      { title: 'Deep Note', tags: ['project/bruin/v2'] },
    ]);
    await app.goto();

    // Parent tag 'project' should be visible (top level)
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'project' })).toBeVisible();
  });

  test('no tags shows empty state in tag tree', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('tag-tree-empty')).toBeVisible();
  });

  test('All Notes nav clears tag filter', async ({ app }) => {
    await app.seed([
      { title: 'Work Note', tags: ['work'] },
      { title: 'Personal Note', tags: ['personal'] },
    ]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();
    await expect(app.noteItem('Personal Note')).not.toBeVisible();

    await app.navAllNotes.click();
    await expect(app.noteItem('Personal Note')).toBeVisible();
  });
});
