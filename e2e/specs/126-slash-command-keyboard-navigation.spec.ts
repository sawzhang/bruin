/**
 * SlashCommandMenu keyboard navigation tests: SlashCommandMenu.tsx exposes an
 * onKeyDown handler (via useImperativeHandle) that moves the highlighted item on
 * ArrowUp/ArrowDown and executes the selected item on Enter. The first item
 * always starts highlighted (index 0 → bg-bear-active). Spec 42
 * (editor-slash-commands) only uses keyboard.type('/') then direct click —
 * it never presses ArrowDown/ArrowUp/Enter.
 * Complements spec 42 (editor slash commands).
 *
 * Item order: Heading 1 (0), Heading 2 (1), Heading 3 (2), Bullet List (3), …
 */
import { test, expect } from '../fixtures';

async function openSlashMenu(app: import('../page-objects/AppPage').AppPage) {
  await app.seed([{ title: 'Slash Nav Note' }]);
  await app.goto();
  await app.noteItem('Slash Nav Note').click();

  const editor = app.page.locator('.ProseMirror');
  await editor.click();
  await app.page.keyboard.press('End');
  await app.page.keyboard.press('Enter');
  await app.page.keyboard.type('/');

  // Wait until the menu is rendered
  await expect(app.page.getByRole('button', { name: 'Heading 1' })).toBeVisible();
  return editor;
}

test.describe('Slash Command Keyboard Navigation', () => {
  test('first slash command item (Heading 1) has bg-bear-active by default', async ({ app }) => {
    await openSlashMenu(app);

    await expect(app.page.getByRole('button', { name: 'Heading 1' })).toHaveClass(/bg-bear-active/);
  });

  test('ArrowDown moves highlight from Heading 1 to Heading 2', async ({ app }) => {
    await openSlashMenu(app);

    await app.page.keyboard.press('ArrowDown');

    await expect(app.page.getByRole('button', { name: 'Heading 2' })).toHaveClass(/bg-bear-active/);
    await expect(app.page.getByRole('button', { name: 'Heading 1' })).not.toHaveClass(
      /bg-bear-active/,
    );
  });

  test('two ArrowDown presses highlight Heading 3', async ({ app }) => {
    await openSlashMenu(app);

    await app.page.keyboard.press('ArrowDown');
    await app.page.keyboard.press('ArrowDown');

    await expect(app.page.getByRole('button', { name: 'Heading 3' })).toHaveClass(/bg-bear-active/);
    await expect(app.page.getByRole('button', { name: 'Heading 1' })).not.toHaveClass(
      /bg-bear-active/,
    );
    await expect(app.page.getByRole('button', { name: 'Heading 2' })).not.toHaveClass(
      /bg-bear-active/,
    );
  });

  test('ArrowDown then ArrowUp returns highlight to Heading 1', async ({ app }) => {
    await openSlashMenu(app);

    await app.page.keyboard.press('ArrowDown');
    await app.page.keyboard.press('ArrowUp');

    await expect(app.page.getByRole('button', { name: 'Heading 1' })).toHaveClass(/bg-bear-active/);
    await expect(app.page.getByRole('button', { name: 'Heading 2' })).not.toHaveClass(
      /bg-bear-active/,
    );
  });

  test('Enter executes the highlighted item (default Heading 1 inserts h1)', async ({ app }) => {
    await app.seed([{ title: 'Enter Slash Note' }]);
    await app.goto();
    await app.noteItem('Enter Slash Note').click();

    const editor = app.page.locator('.ProseMirror');
    await editor.click();
    await app.page.keyboard.press('End');
    await app.page.keyboard.press('Enter');
    await app.page.keyboard.type('/heading');

    // Wait for the filtered list — Heading 1 is first (index 0)
    await expect(app.page.getByRole('button', { name: 'Heading 1' })).toBeVisible();

    await app.page.keyboard.press('Enter');

    await expect(editor.locator('h1')).toBeVisible();
  });
});
