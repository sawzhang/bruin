/**
 * Editor bubble menu tests: text selection triggers the formatting toolbar,
 * and each button applies/removes the corresponding mark or block type.
 */
import { test, expect } from '../fixtures';

async function openNoteAndTypeText(app: import('../page-objects/AppPage').AppPage, text: string) {
  await app.seed([{ title: 'Format Note' }]);
  await app.goto();
  await app.noteItem('Format Note').click();

  // Type into the ProseMirror editor
  const editor = app.page.locator('.ProseMirror');
  await editor.click();
  await app.page.keyboard.type(text);
  return editor;
}

test.describe('Editor Bubble Menu', () => {
  test('bubble menu appears when text is selected in the editor', async ({ app }) => {
    const editor = await openNoteAndTypeText(app, 'Hello world');

    // Triple-click to select the paragraph
    await editor.click({ clickCount: 3 });

    // Bold button should appear in the bubble menu
    await expect(app.page.getByRole('button', { name: 'B', exact: true })).toBeVisible();
  });

  test('bubble menu shows B, I, <>, H, ~ buttons', async ({ app }) => {
    const editor = await openNoteAndTypeText(app, 'Format me');
    await editor.click({ clickCount: 3 });

    await expect(app.page.getByRole('button', { name: 'B', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'I', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: '<>', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'H', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: '~', exact: true })).toBeVisible();
  });

  test('clicking B applies bold formatting to selected text', async ({ app }) => {
    const editor = await openNoteAndTypeText(app, 'Bold this');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: 'B', exact: true }).click();

    await expect(editor.locator('strong')).toBeVisible();
  });

  test('clicking I applies italic formatting to selected text', async ({ app }) => {
    const editor = await openNoteAndTypeText(app, 'Italic this');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: 'I', exact: true }).click();

    await expect(editor.locator('em')).toBeVisible();
  });

  test('clicking H converts the selection to a heading', async ({ app }) => {
    const editor = await openNoteAndTypeText(app, 'Heading text');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: 'H', exact: true }).click();

    await expect(editor.locator('h2')).toBeVisible();
  });

  test('clicking <> applies inline code formatting', async ({ app }) => {
    const editor = await openNoteAndTypeText(app, 'code snippet');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: '<>', exact: true }).click();

    await expect(editor.locator('code')).toBeVisible();
  });

  test('clicking bold button again removes bold (toggle)', async ({ app }) => {
    const editor = await openNoteAndTypeText(app, 'Toggle bold');
    await editor.click({ clickCount: 3 });

    // Apply bold
    await app.page.getByRole('button', { name: 'B', exact: true }).click();
    await expect(editor.locator('strong')).toBeVisible();

    // Re-select and remove bold
    await editor.click({ clickCount: 3 });
    await app.page.getByRole('button', { name: 'B', exact: true }).click();
    await expect(editor.locator('strong')).not.toBeVisible();
  });
});
