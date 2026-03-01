/**
 * EditorPanel trash-view button CSS class tests: spec 60 (editor in trash state)
 * only asserts toBeVisible() and readonly attribute — it never checks the colour
 * classes on btn-restore (text-green-400) or btn-delete-permanent (text-red-400)
 * that are baked into EditorPanel.tsx.
 * Complements spec 60 (editor in trash state).
 */
import { test, expect } from '../fixtures';

async function openTrashedNote(app: import('../page-objects/AppPage').AppPage, title: string) {
  await app.seed([{ title }]);
  await app.goto();
  await app.openNoteContextMenu(title);
  await app.clickContextMenuItem('Move to Trash');
  await app.navTrash.click();
  await app.page.getByTestId('note-item').filter({ hasText: title }).click();
}

test.describe('Editor Trash Button CSS', () => {
  test('btn-restore has text-green-400 class', async ({ app }) => {
    await openTrashedNote(app, 'Green Restore Note');

    await expect(app.page.getByTestId('btn-restore')).toHaveClass(/text-green-400/);
  });

  test('btn-delete-permanent has text-red-400 class', async ({ app }) => {
    await openTrashedNote(app, 'Red Delete Note');

    await expect(app.page.getByTestId('btn-delete-permanent')).toHaveClass(/text-red-400/);
  });

  test('btn-restore has hover:bg-green-500/10 class', async ({ app }) => {
    await openTrashedNote(app, 'Restore Hover Note');

    await expect(app.page.getByTestId('btn-restore')).toHaveClass(/hover:bg-green-500\/10/);
  });

  test('btn-delete-permanent has hover:bg-red-500/10 class', async ({ app }) => {
    await openTrashedNote(app, 'Delete Hover Note');

    await expect(app.page.getByTestId('btn-delete-permanent')).toHaveClass(/hover:bg-red-500\/10/);
  });

  test('btn-restore has border class', async ({ app }) => {
    await openTrashedNote(app, 'Restore Border Note');

    await expect(app.page.getByTestId('btn-restore')).toHaveClass(/border/);
  });

  test('btn-restore and btn-delete-permanent are both visible in trash view', async ({ app }) => {
    await openTrashedNote(app, 'Both Buttons Note');

    await expect(app.page.getByTestId('btn-restore')).toBeVisible();
    await expect(app.page.getByTestId('btn-delete-permanent')).toBeVisible();
  });

  test('btn-restore does not have text-red-400 class', async ({ app }) => {
    await openTrashedNote(app, 'No Red Restore Note');

    await expect(app.page.getByTestId('btn-restore')).not.toHaveClass(/text-red-400/);
  });
});
