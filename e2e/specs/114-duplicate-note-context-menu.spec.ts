/**
 * "Duplicate Note" context menu tests: NoteList.tsx defines a "Duplicate Note"
 * context menu item (line ~358) that creates a copy with the original title
 * plus " (copy)", the same content, and the same tags. No prior spec tests
 * this item. Spec 44 covers Copy, Copy Link, Copy Note ID, and Export Note,
 * but never "Duplicate Note".
 * Complements spec 44 (context menu extra) and spec 19 (note context menu).
 */
import { test, expect } from '../fixtures';

test.describe('Duplicate Note Context Menu', () => {
  test('"Duplicate Note" is visible in the single-note context menu', async ({ app }) => {
    await app.seed([{ title: 'Source Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Source Note');

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Duplicate Note' }),
    ).toBeVisible();
  });

  test('clicking "Duplicate Note" adds a new note with "(copy)" in the title', async ({ app }) => {
    await app.seed([{ title: 'Original Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Original Note');
    await app.clickContextMenuItem('Duplicate Note');

    await expect(app.noteItem('Original Note (copy)')).toBeVisible();
  });

  test('original note remains visible after duplication', async ({ app }) => {
    await app.seed([{ title: 'Keep This Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Keep This Note');
    await app.clickContextMenuItem('Duplicate Note');

    await expect(app.noteItem('Keep This Note')).toBeVisible();
    await expect(app.noteItem('Keep This Note (copy)')).toBeVisible();
  });

  test('duplicate note appears in the note list with "(copy)" suffix', async ({ app }) => {
    await app.seed([{ title: 'Copy Suffix Test' }]);
    await app.goto();

    await app.openNoteContextMenu('Copy Suffix Test');
    await app.clickContextMenuItem('Duplicate Note');

    // Confirm the copy exists and has the expected title format
    const copyItem = app.noteItem('Copy Suffix Test (copy)');
    await expect(copyItem).toBeVisible();
    await expect(copyItem).toContainText('Copy Suffix Test (copy)');
  });

  test('duplicate note inherits the same tags as the original', async ({ app }) => {
    await app.seed([{ title: 'Tagged Original', tags: ['design', 'ux'] }]);
    await app.goto();

    await app.openNoteContextMenu('Tagged Original');
    await app.clickContextMenuItem('Duplicate Note');

    // The copy should show the same tags in the note list item
    const copyItem = app.noteItem('Tagged Original (copy)');
    await expect(copyItem).toBeVisible();
    await expect(copyItem.getByText('design')).toBeVisible();
    await expect(copyItem.getByText('ux')).toBeVisible();
  });

  test('"Duplicate Note" does not appear in the multi-select context menu', async ({ app }) => {
    await app.seed([
      { title: 'Multi A' },
      { title: 'Multi B' },
    ]);
    await app.goto();

    await app.noteItem('Multi A').click();
    await app.noteItem('Multi B').click({ modifiers: ['Shift'] });
    await app.noteItem('Multi B').click({ button: 'right' });

    // Multi-select menu only shows Pin N Notes / Move N Notes to Trash
    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Duplicate Note' }),
    ).not.toBeVisible();
  });
});
