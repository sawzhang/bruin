/**
 * Trash view counter text (singular/plural) and empty-state text variants.
 * The counter "N note(s) in trash" renders in the trash header only when notes
 * exist; the empty state shows "Trash is empty" + subtext when there are none.
 * Complements spec 17 (basic trash), spec 59 (trash extras), and spec 27 (cancel).
 */
import { test, expect } from '../fixtures';

test.describe('Trash Counter and Empty State', () => {
  test('trash header shows "1 note in trash" (singular) for one trashed note', async ({ app }) => {
    await app.seed([{ title: 'Single Trash Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Single Trash Note');
    await app.clickContextMenuItem('Move to Trash');

    await app.navTrash.click();

    await expect(app.page.locator('text=1 note in trash')).toBeVisible();
  });

  test('trash header shows "2 notes in trash" (plural) for two trashed notes', async ({ app }) => {
    await app.seed([
      { title: 'Trash A' },
      { title: 'Trash B' },
    ]);
    await app.goto();

    await app.openNoteContextMenu('Trash A');
    await app.clickContextMenuItem('Move to Trash');
    await app.openNoteContextMenu('Trash B');
    await app.clickContextMenuItem('Move to Trash');

    await app.navTrash.click();

    await expect(app.page.locator('text=2 notes in trash')).toBeVisible();
  });

  test('trash counter is not visible when trash is empty', async ({ app }) => {
    await app.goto();
    await app.navTrash.click();

    await expect(app.page.locator('text=/\\d+ note/')).not.toBeVisible();
  });

  test('trash counter is not visible in All Notes view', async ({ app }) => {
    await app.seed([{ title: 'Live Note' }]);
    await app.goto();

    // Stay in All Notes view — no counter
    await expect(app.page.locator('text=/\\d+ note.*in trash/')).not.toBeVisible();
  });

  test('"Trash is empty" text shows in empty trash view', async ({ app }) => {
    await app.goto();
    await app.navTrash.click();

    await expect(app.page.getByTestId('note-list-empty')).toBeVisible();
    await expect(app.page.getByTestId('note-list-empty')).toContainText('Trash is empty');
  });

  test('"Deleted notes will appear here" subtext shows in empty trash', async ({ app }) => {
    await app.goto();
    await app.navTrash.click();

    await expect(app.page.getByTestId('note-list-empty')).toContainText('Deleted notes will appear here');
  });

  test('"No notes" text shows in empty All Notes view', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-list-empty')).toContainText('No notes');
  });

  test('"No notes" empty state does NOT say "Trash is empty"', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-list-empty')).not.toContainText('Trash is empty');
  });
});
