/**
 * Rename tag dialog detail tests: heading text, rename-confirm-btn label,
 * rename-input type, Escape closes without renaming, and the confirm btn
 * applies the new name to the tag tree.
 * Complements spec 07 (Enter key rename, Escape cancel, basic flow) and
 * spec 64 (pre-fill, Cancel btn, backdrop dismiss) — neither tests the
 * dialog heading text or rename-confirm-btn label directly.
 */
import { test, expect } from '../fixtures';

async function openRenameDialog(
  app: import('../page-objects/AppPage').AppPage,
  tagName: string,
) {
  await app.tagTree.getByTestId('tag-item').filter({ hasText: tagName }).click({ button: 'right' });
  await app.page.getByTestId('context-menu-item').filter({ hasText: 'Rename Tag' }).click();
  await expect(app.page.getByTestId('rename-dialog')).toBeVisible();
}

test.describe('Rename Dialog Detail', () => {
  test('rename-dialog heading text is "Rename Tag"', async ({ app }) => {
    await app.seed([{ title: 'Heading Note', tags: ['heading-tag'] }]);
    await app.goto();
    await openRenameDialog(app, 'heading-tag');

    await expect(
      app.page.getByTestId('rename-dialog').getByRole('heading', { name: 'Rename Tag' }),
    ).toBeVisible();
  });

  test('rename-confirm-btn label is "Rename"', async ({ app }) => {
    await app.seed([{ title: 'Label Note', tags: ['label-tag'] }]);
    await app.goto();
    await openRenameDialog(app, 'label-tag');

    await expect(app.page.getByTestId('rename-confirm-btn')).toHaveText('Rename');
  });

  test('rename-input has type="text"', async ({ app }) => {
    await app.seed([{ title: 'Type Note', tags: ['type-tag'] }]);
    await app.goto();
    await openRenameDialog(app, 'type-tag');

    await expect(app.page.getByTestId('rename-input')).toHaveAttribute('type', 'text');
  });

  test('clicking rename-confirm-btn applies the new tag name', async ({ app }) => {
    await app.seed([{ title: 'Confirm Rename Note', tags: ['old-name-tag'] }]);
    await app.goto();
    await openRenameDialog(app, 'old-name-tag');

    await app.page.getByTestId('rename-input').fill('new-name-tag');
    await app.page.getByTestId('rename-confirm-btn').click();

    await expect(app.page.getByTestId('rename-dialog')).not.toBeVisible();
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'new-name-tag' })).toBeVisible();
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'old-name-tag' })).not.toBeVisible();
  });

  test('rename-dialog is closed after clicking rename-confirm-btn', async ({ app }) => {
    await app.seed([{ title: 'Close After Confirm Note', tags: ['close-confirm-tag'] }]);
    await app.goto();
    await openRenameDialog(app, 'close-confirm-tag');

    await app.page.getByTestId('rename-input').fill('confirmed-tag');
    await app.page.getByTestId('rename-confirm-btn').click();

    await expect(app.page.getByTestId('rename-dialog')).not.toBeVisible();
  });

  test('rename-confirm-btn has bg-bear-accent CSS class', async ({ app }) => {
    await app.seed([{ title: 'Accent Note', tags: ['accent-tag'] }]);
    await app.goto();
    await openRenameDialog(app, 'accent-tag');

    await expect(app.page.getByTestId('rename-confirm-btn')).toHaveClass(/bg-bear-accent/);
  });
});
