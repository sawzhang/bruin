/**
 * Slash command block insertion tests using data-testid selectors.
 * Uses the `data-testid="slash-cmd-{title-kebab}"` approach for selecting
 * slash command menu items, complementing spec 42 (which uses getByRole).
 */
import { test, expect } from '../fixtures';

async function openNoteEditor(app: import('../page-objects/AppPage').AppPage) {
  await app.seed([{ title: 'Slash Block Note' }]);
  await app.goto();
  await app.noteItem('Slash Block Note').click();
  const editor = app.page.locator('.ProseMirror');
  await editor.click();
  return editor;
}

test.describe('Slash Command Blocks (testid)', () => {
  test('typing "/" and selecting "Heading 2" via testid inserts an h2', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');

    await app.page.getByTestId('slash-cmd-heading-2').click();

    await expect(editor.locator('h2')).toBeVisible();
  });

  test('typing "/" and selecting "Bullet List" via testid inserts a ul', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');

    await app.page.getByTestId('slash-cmd-bullet-list').click();

    await expect(editor.locator('ul')).toBeVisible();
  });

  test('typing "/" and selecting "Code Block" via testid inserts a pre', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');

    await app.page.getByTestId('slash-cmd-code-block').click();

    await expect(editor.locator('pre')).toBeVisible();
  });

  test('typing "/heading" filters to show heading commands and hides unrelated', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/heading');

    // Heading commands should be visible
    await expect(app.page.getByTestId('slash-cmd-heading-1')).toBeVisible();
    await expect(app.page.getByTestId('slash-cmd-heading-2')).toBeVisible();
    await expect(app.page.getByTestId('slash-cmd-heading-3')).toBeVisible();

    // Non-heading commands should be hidden
    await expect(app.page.getByTestId('slash-cmd-bullet-list')).not.toBeVisible();
    await expect(app.page.getByTestId('slash-cmd-code-block')).not.toBeVisible();
  });

  test('typing "/" then Escape closes the menu without inserting any block', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');

    // Menu should be visible
    await expect(app.page.getByTestId('slash-cmd-heading-1')).toBeVisible();

    await app.page.keyboard.press('Escape');

    // Menu should be dismissed
    await expect(app.page.getByTestId('slash-cmd-heading-1')).not.toBeVisible();

    // No block elements should have been inserted
    await expect(editor.locator('h1')).not.toBeVisible();
    await expect(editor.locator('h2')).not.toBeVisible();
    await expect(editor.locator('ul')).not.toBeVisible();
    await expect(editor.locator('pre')).not.toBeVisible();
  });
});
