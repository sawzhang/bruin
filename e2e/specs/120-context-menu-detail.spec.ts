/**
 * Context menu structural detail tests: ContextMenu.tsx sets data-label={item.label}
 * on every context-menu-item and applies text-red-400 to "danger" variant items.
 * The menu also closes on Escape keydown and on outside click. None of these
 * behaviours have been asserted in specs 19, 44, or 100.
 * Complements spec 19 (note context menu) and spec 44 (context menu extra).
 */
import { test, expect } from '../fixtures';

test.describe('Context Menu Detail', () => {
  test('context-menu-item has data-label attribute matching its label text', async ({ app }) => {
    await app.seed([{ title: 'Label Attr Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Label Attr Note');

    // "Pin to Top" item should have data-label="Pin to Top"
    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Pin to Top' }),
    ).toHaveAttribute('data-label', 'Pin to Top');
  });

  test('multiple context-menu-items each have their own data-label', async ({ app }) => {
    await app.seed([{ title: 'Multi Label Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Multi Label Note');

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Copy' }),
    ).toHaveAttribute('data-label', 'Copy');

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Copy Note ID' }),
    ).toHaveAttribute('data-label', 'Copy Note ID');
  });

  test('"Move to Trash" danger item has text-red-400 class', async ({ app }) => {
    await app.seed([{ title: 'Danger Color Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Danger Color Note');

    // "Move to Trash" uses variant: "danger" → text-red-400 hover:bg-red-500/10
    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Move to Trash' }),
    ).toHaveClass(/text-red-400/);
  });

  test('non-danger item does not have text-red-400 class', async ({ app }) => {
    await app.seed([{ title: 'Non-Danger Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Non-Danger Note');

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Pin to Top' }),
    ).not.toHaveClass(/text-red-400/);
  });

  test('pressing Escape closes the context menu', async ({ app }) => {
    await app.seed([{ title: 'Escape Close Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Escape Close Note');
    await expect(app.page.getByTestId('context-menu')).toBeVisible();

    await app.page.keyboard.press('Escape');

    await expect(app.page.getByTestId('context-menu')).not.toBeVisible();
  });

  test('clicking outside the context menu closes it', async ({ app }) => {
    await app.seed([{ title: 'Outside Click Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Outside Click Note');
    await expect(app.page.getByTestId('context-menu')).toBeVisible();

    // Click far from the menu (top-left corner)
    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('context-menu')).not.toBeVisible();
  });

  test('"Move to Trash" data-label is "Move to Trash"', async ({ app }) => {
    await app.seed([{ title: 'Trash Label Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Trash Label Note');

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: 'Move to Trash' }),
    ).toHaveAttribute('data-label', 'Move to Trash');
  });
});
