/**
 * Editor header tag display tests: EditorPanel renders note tags as clickable
 * `#{tag}` chips in the header (px-8 area below the state badge). No prior spec
 * tests this; spec 43 only tests tags in the *note-list item*, not in the editor
 * panel header. Clicking a tag in the editor header calls selectTag(), which
 * activates the tag filter in the sidebar.
 * Complements spec 43 (note item tag display) and spec 04 (tag filtering).
 */
import { test, expect } from '../fixtures';

test.describe('Editor Header Tags', () => {
  test('tagged note shows its tag in the editor header with "#" prefix', async ({ app }) => {
    await app.seed([{ title: 'Tagged Editor Note', tags: ['design'] }]);
    await app.goto();
    await app.noteItem('Tagged Editor Note').click();

    // Editor header renders each tag as "#<name>"
    await expect(app.editorPanel.getByText('#design')).toBeVisible();
  });

  test('multiple tags all appear in the editor header', async ({ app }) => {
    await app.seed([{ title: 'Multi Tag Note', tags: ['work', 'urgent'] }]);
    await app.goto();
    await app.noteItem('Multi Tag Note').click();

    await expect(app.editorPanel.getByText('#work')).toBeVisible();
    await expect(app.editorPanel.getByText('#urgent')).toBeVisible();
  });

  test('editor header shows no tag chips when note has no tags', async ({ app }) => {
    await app.seed([{ title: 'No Tags Note', tags: [] }]);
    await app.goto();
    await app.noteItem('No Tags Note').click();

    // The tag container div is only rendered when tags.length > 0
    await expect(app.editorPanel.getByText(/#\w/)).not.toBeVisible();
  });

  test('clicking a tag in the editor header activates that tag in the sidebar', async ({
    app,
  }) => {
    await app.seed([
      { title: 'Filtered By Tag Note', tags: ['project'] },
      { title: 'Unrelated Note', tags: [] },
    ]);
    await app.goto();
    await app.noteItem('Filtered By Tag Note').click();

    await app.editorPanel.getByText('#project').click();

    // The tag should now be selected — unrelated note hidden from note list
    await expect(app.noteItem('Unrelated Note')).not.toBeVisible();
    await expect(app.noteItem('Filtered By Tag Note')).toBeVisible();
  });

  test('clicking a tag in the editor activates that tag-item in the sidebar', async ({
    app,
  }) => {
    await app.seed([{ title: 'Tag Activate Note', tags: ['frontend'] }]);
    await app.goto();
    await app.noteItem('Tag Activate Note').click();

    await app.editorPanel.getByText('#frontend').click();

    // The tag-item in the sidebar should now have the active selection class
    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'frontend' }),
    ).toHaveClass(/bg-bear-active/);
  });

  test('switching to a different note updates the tag chips in the editor', async ({ app }) => {
    await app.seed([
      { title: 'Note Alpha', tags: ['alpha-tag'] },
      { title: 'Note Beta', tags: ['beta-tag'] },
    ]);
    await app.goto();

    await app.noteItem('Note Alpha').click();
    await expect(app.editorPanel.getByText('#alpha-tag')).toBeVisible();

    await app.noteItem('Note Beta').click();
    await expect(app.editorPanel.getByText('#beta-tag')).toBeVisible();
    await expect(app.editorPanel.getByText('#alpha-tag')).not.toBeVisible();
  });
});
