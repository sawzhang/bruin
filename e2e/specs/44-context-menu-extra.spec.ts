/**
 * Additional note context menu tests: clipboard actions, remove-tag-from-note,
 * and multi-select bulk remove-tag.
 * Complements 19-note-context-menu.spec.ts.
 */
import { test, expect } from '../fixtures';

test.describe('Context Menu Extra', () => {
  test('"Copy" option is visible in the single-note context menu', async ({ app }) => {
    await app.seed([{ title: 'Copy Me' }]);
    await app.goto();

    await app.openNoteContextMenu('Copy Me');

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Copy' })
    ).toBeVisible();
  });

  test('"Copy Link" option is visible in the single-note context menu', async ({ app }) => {
    await app.seed([{ title: 'Copy Link Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Copy Link Note');

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Copy Link' })
    ).toBeVisible();
  });

  test('"Copy Note ID" option is visible in the single-note context menu', async ({ app }) => {
    await app.seed([{ title: 'ID Note' }]);
    await app.goto();

    await app.openNoteContextMenu('ID Note');

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Copy Note ID' })
    ).toBeVisible();
  });

  test('"Export Note..." option is visible in the single-note context menu', async ({ app }) => {
    await app.seed([{ title: 'Export Context Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Export Context Note');

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Export Note...' })
    ).toBeVisible();
  });

  test('"Copy Note ID" copies the note id to clipboard', async ({ app }) => {
    await app.seed([{ id: 'note-copy-id-test', title: 'ID Copy Target' }]);
    await app.goto();
    await app.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await app.openNoteContextMenu('ID Copy Target');
    await app.clickContextMenuItem('Copy Note ID');

    const clipText = await app.page.evaluate(() => navigator.clipboard.readText());
    expect(clipText).toBe('note-copy-id-test');
  });

  test('"Copy Link" copies a bruin:// deep-link to clipboard', async ({ app }) => {
    await app.seed([{ id: 'note-link-id-test', title: 'Link Copy Target' }]);
    await app.goto();
    await app.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await app.openNoteContextMenu('Link Copy Target');
    await app.clickContextMenuItem('Copy Link');

    const clipText = await app.page.evaluate(() => navigator.clipboard.readText());
    expect(clipText).toBe('bruin://note/note-link-id-test');
  });

  test('"Remove Tag" appears in context menu when one tag is filtered and note has it', async ({ app }) => {
    await app.seed([{ title: 'Tagged Note', tags: ['work'] }]);
    await app.goto();

    // Filter by the 'work' tag
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();

    // Right-click the note — Remove Tag option should appear
    await app.openNoteContextMenu('Tagged Note');
    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: /Remove Tag #work/ })
    ).toBeVisible();
  });

  test('"Remove Tag" does not appear when no tag is filtered', async ({ app }) => {
    await app.seed([{ title: 'Tagged Note 2', tags: ['dev'] }]);
    await app.goto();

    // No tag filter active
    await app.openNoteContextMenu('Tagged Note 2');

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: /Remove Tag/ })
    ).not.toBeVisible();
  });

  test('clicking "Remove Tag" removes the tag and note disappears from filtered view', async ({ app }) => {
    await app.seed([
      { title: 'Removable Note', tags: ['alpha'] },
      { title: 'Keeper Note', tags: ['alpha'] },
    ]);
    await app.goto();

    // Filter by 'alpha' — both notes visible
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'alpha' }).click();
    await expect(app.noteItem('Removable Note')).toBeVisible();
    await expect(app.noteItem('Keeper Note')).toBeVisible();

    // Remove the tag from one note
    await app.openNoteContextMenu('Removable Note');
    await app.clickContextMenuItem('Remove Tag #alpha');

    // That note should disappear from the alpha-filtered list
    await expect(app.noteItem('Removable Note')).not.toBeVisible();
    await expect(app.noteItem('Keeper Note')).toBeVisible();
  });
});
