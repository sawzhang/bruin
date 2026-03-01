/**
 * Tag operation tests: pin, rename, delete via context menu
 */
import { test, expect } from '../fixtures';

test.describe('Tag Operations', () => {
  test.beforeEach(async ({ app }) => {
    await app.seed([{ title: 'My Note', tags: ['work'] }]);
    await app.goto();
  });

  test('right-clicking a tag opens a context menu', async ({ app }) => {
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click({ button: 'right' });

    await expect(app.page.getByTestId('context-menu')).toBeVisible();
  });

  test('context menu shows Pin, Rename, and Delete options', async ({ app }) => {
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click({ button: 'right' });
    const menu = app.page.getByTestId('context-menu');

    await expect(menu.getByTestId('context-menu-item').filter({ hasText: 'Pin Tag' })).toBeVisible();
    await expect(menu.getByTestId('context-menu-item').filter({ hasText: 'Rename Tag' })).toBeVisible();
    await expect(menu.getByTestId('context-menu-item').filter({ hasText: 'Delete Tag' })).toBeVisible();
  });

  test('pinning a tag changes menu to Unpin Tag', async ({ app }) => {
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Pin Tag' }).click();

    // Re-open context menu — state is now pinned
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click({ button: 'right' });
    await expect(app.page.getByTestId('context-menu-item').filter({ hasText: 'Unpin Tag' })).toBeVisible();
  });

  test('renaming a tag shows the rename dialog and updates the tree', async ({ app }) => {
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Rename Tag' }).click();

    await expect(app.page.getByTestId('rename-dialog')).toBeVisible();
    await app.page.getByTestId('rename-input').fill('personal');
    await app.page.getByTestId('rename-confirm-btn').click();

    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'personal' })).toBeVisible();
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' })).not.toBeVisible();
  });

  test('pressing Enter in rename input confirms the rename', async ({ app }) => {
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Rename Tag' }).click();

    await app.page.getByTestId('rename-input').fill('projects');
    await app.page.keyboard.press('Enter');

    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'projects' })).toBeVisible();
  });

  test('pressing Escape in rename input cancels the rename', async ({ app }) => {
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Rename Tag' }).click();

    await app.page.getByTestId('rename-input').fill('should-not-appear');
    await app.page.keyboard.press('Escape');

    await expect(app.page.getByTestId('rename-dialog')).not.toBeVisible();
    // Original tag still exists
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' })).toBeVisible();
  });

  test('deleting a tag shows confirm dialog and removes it from the tree', async ({ app }) => {
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Delete Tag' }).click();

    await expect(app.page.getByTestId('confirm-dialog')).toBeVisible();
    await app.confirmDialog();

    await expect(app.page.getByTestId('tag-tree-empty')).toBeVisible();
  });
});
