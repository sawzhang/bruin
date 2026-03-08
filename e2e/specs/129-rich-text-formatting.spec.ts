/**
 * Rich text formatting tests: select text in the editor, apply formatting
 * via BubbleMenu buttons, and verify the resulting DOM elements.
 * Complements spec 41 (bubble menu visibility) and spec 125 (active CSS)
 * by verifying the actual HTML elements contain the expected text content.
 */
import { test, expect } from '../fixtures';

async function openNoteAndType(app: import('../page-objects/AppPage').AppPage, text: string) {
  await app.seed([{ title: 'Rich Format Note' }]);
  await app.goto();
  await app.noteItem('Rich Format Note').click();
  const editor = app.page.locator('.ProseMirror');
  await editor.click();
  await app.page.keyboard.type(text);
  return editor;
}

test.describe('Rich Text Formatting', () => {
  test('selecting text and clicking B creates a <strong> element with that text', async ({ app }) => {
    const editor = await openNoteAndType(app, 'make this bold');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: 'B', exact: true }).click();

    const strong = editor.locator('strong');
    await expect(strong).toBeVisible();
    await expect(strong).toContainText('make this bold');
  });

  test('selecting text and clicking I creates an <em> element with that text', async ({ app }) => {
    const editor = await openNoteAndType(app, 'make this italic');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: 'I', exact: true }).click();

    const em = editor.locator('em');
    await expect(em).toBeVisible();
    await expect(em).toContainText('make this italic');
  });

  test('selecting text and clicking <> creates a <code> element with that text', async ({ app }) => {
    const editor = await openNoteAndType(app, 'inline code here');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: '<>', exact: true }).click();

    const code = editor.locator('code');
    await expect(code).toBeVisible();
    await expect(code).toContainText('inline code here');
  });

  test('bold formatting persists after clicking away and re-selecting', async ({ app }) => {
    const editor = await openNoteAndType(app, 'persistent bold');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: 'B', exact: true }).click();

    // Click away to deselect, then verify the strong element still exists
    await app.page.getByTestId('editor-title').click();
    await expect(editor.locator('strong')).toBeVisible();
    await expect(editor.locator('strong')).toContainText('persistent bold');
  });

  test('italic formatting persists after clicking away and re-selecting', async ({ app }) => {
    const editor = await openNoteAndType(app, 'persistent italic');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: 'I', exact: true }).click();

    await app.page.getByTestId('editor-title').click();
    await expect(editor.locator('em')).toBeVisible();
    await expect(editor.locator('em')).toContainText('persistent italic');
  });

  test('code formatting persists after clicking away and re-selecting', async ({ app }) => {
    const editor = await openNoteAndType(app, 'persistent code');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: '<>', exact: true }).click();

    await app.page.getByTestId('editor-title').click();
    await expect(editor.locator('code')).toBeVisible();
    await expect(editor.locator('code')).toContainText('persistent code');
  });
});
