/**
 * Tag context menu operations: verifies that right-clicking a tag in the
 * sidebar tag-tree opens a context menu with Pin, Rename, and Delete options,
 * and that each operation behaves correctly.
 * Complements spec 07 (tag-ops) with focused, self-contained tests.
 */
import { test, expect } from '../fixtures';

test.describe('Tag Context Menu Operations', () => {
  test('right-click tag shows context menu with Pin, Rename, Delete', async ({ app }) => {
    await app.seed([{ title: 'Tagged Note', tags: ['design'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'design' }).click({ button: 'right' });

    const menu = app.page.getByTestId('context-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByTestId('context-menu-item').filter({ hasText: 'Pin Tag' })).toBeVisible();
    await expect(menu.getByTestId('context-menu-item').filter({ hasText: 'Rename Tag' })).toBeVisible();
    await expect(menu.getByTestId('context-menu-item').filter({ hasText: 'Delete Tag' })).toBeVisible();
  });

  test('pinning a tag changes context menu to show "Unpin Tag"', async ({ app }) => {
    await app.seed([{ title: 'Pin Tag Note', tags: ['urgent'] }]);
    await app.goto();

    // Pin the tag
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'urgent' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Pin Tag' }).click();

    // Re-open context menu — should now show "Unpin Tag"
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'urgent' }).click({ button: 'right' });
    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Unpin Tag' }),
    ).toBeVisible();
  });

  test('renaming a tag updates its name in the sidebar', async ({ app }) => {
    await app.seed([{ title: 'Rename Tag Note', tags: ['old-name'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'old-name' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Rename Tag' }).click();

    await expect(app.page.getByTestId('rename-dialog')).toBeVisible();
    await app.page.getByTestId('rename-input').fill('new-name');
    await app.page.getByTestId('rename-confirm-btn').click();

    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'new-name' })).toBeVisible();
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'old-name' })).not.toBeVisible();
  });

  test('deleting a tag removes it from the sidebar after confirmation', async ({ app }) => {
    await app.seed([{ title: 'Delete Tag Note', tags: ['ephemeral'] }]);
    await app.goto();

    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'ephemeral' })).toBeVisible();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'ephemeral' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Delete Tag' }).click();

    await expect(app.page.getByTestId('confirm-dialog')).toBeVisible();
    await app.confirmDialog();

    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'ephemeral' })).not.toBeVisible();
  });
});
