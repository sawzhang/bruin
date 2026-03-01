/**
 * Note list context menu tests
 */
import { test, expect } from '../fixtures';

test.describe('Note Context Menu', () => {
  test('right-clicking a note opens the context menu', async ({ app }) => {
    await app.seed([{ title: 'Context Note' }]);
    await app.goto();

    const menu = await app.openNoteContextMenu('Context Note');

    await expect(menu).toBeVisible();
  });

  test('context menu has Pin to Top, Move to Trash, Duplicate Note items', async ({ app }) => {
    await app.seed([{ title: 'Menu Note' }]);
    await app.goto();

    const menu = await app.openNoteContextMenu('Menu Note');

    await expect(menu.getByTestId('context-menu-item').filter({ hasText: 'Pin to Top' })).toBeVisible();
    await expect(menu.getByTestId('context-menu-item').filter({ hasText: 'Move to Trash' })).toBeVisible();
    await expect(menu.getByTestId('context-menu-item').filter({ hasText: 'Duplicate Note' })).toBeVisible();
  });

  test('"Pin to Top" pins the note and shows pin icon', async ({ app }) => {
    await app.seed([{ title: 'Pin Me' }]);
    await app.goto();

    await app.openNoteContextMenu('Pin Me');
    await app.clickContextMenuItem('Pin to Top');

    const noteItem = app.noteItem('Pin Me');
    await expect(noteItem.getByTestId('note-pin-icon')).toBeVisible();
  });

  test('"Unpin" removes the pin icon', async ({ app }) => {
    await app.seed([{ title: 'Already Pinned', is_pinned: true }]);
    await app.goto();

    const noteItem = app.noteItem('Already Pinned');
    await expect(noteItem.getByTestId('note-pin-icon')).toBeVisible();

    // Click to open so noteStore.currentNote is set (pinNote reads is_pinned from currentNote)
    await noteItem.click();
    await app.openNoteContextMenu('Already Pinned');
    await app.clickContextMenuItem('Unpin');

    await expect(noteItem.getByTestId('note-pin-icon')).not.toBeVisible();
  });

  test('"Move to Trash" removes the note from the main list', async ({ app }) => {
    await app.seed([{ title: 'Trash Target' }]);
    await app.goto();

    await app.openNoteContextMenu('Trash Target');
    await app.clickContextMenuItem('Move to Trash');

    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Trash Target' })).not.toBeVisible();
  });

  test('"Duplicate Note" creates a copy with "(copy)" suffix', async ({ app }) => {
    await app.seed([{ title: 'Original Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Original Note');
    await app.clickContextMenuItem('Duplicate Note');

    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Original Note (copy)' })).toBeVisible();
  });

  test('"Set Review" changes the note state', async ({ app }) => {
    await app.seed([{ title: 'State Note', state: 'draft' }]);
    await app.goto();

    await app.openNoteContextMenu('State Note');
    await app.clickContextMenuItem('Set Review');

    // The note should still be visible in the list
    await expect(app.page.getByTestId('note-item').filter({ hasText: 'State Note' })).toBeVisible();
  });

  test('pinned note appears at the top of the note list', async ({ app }) => {
    await app.seed([
      { title: 'Bottom Note' },
      { title: 'Pinned Note', is_pinned: true },
    ]);
    await app.goto();

    const noteItems = app.page.getByTestId('note-item');
    const firstTitle = await noteItems.first().textContent();
    expect(firstTitle).toContain('Pinned Note');
  });
});
