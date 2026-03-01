/**
 * Wiki-link navigation tests
 * Covers: clicking [[Title]] in the editor navigates to the referenced note
 */
import { test, expect } from '../fixtures';

test.describe('Wiki-link Navigation', () => {
  test('typing [[Title]] and space creates a wiki-link node', async ({ app }) => {
    await app.seed([
      { title: 'Source Note' },
      { title: 'Target Note' },
    ]);
    await app.goto();

    await app.noteItem('Source Note').click();

    // Click into the editor body and type a wiki-link
    const editorBody = app.page.getByTestId('editor-body');
    await editorBody.click();
    await app.page.keyboard.type('[[Target Note]] ');

    // The wiki-link node renders as [[Target Note]] inside the editor
    await expect(editorBody.locator('span.wiki-link')).toBeVisible();
    await expect(editorBody.locator('span.wiki-link')).toContainText('Target Note');
  });

  test('clicking a [[wiki-link]] navigates to the referenced note', async ({ app }) => {
    await app.seed([
      { title: 'Source Note' },
      { title: 'Target Note' },
    ]);
    await app.goto();

    await app.noteItem('Source Note').click();

    // Type the wiki-link in the editor
    const editorBody = app.page.getByTestId('editor-body');
    await editorBody.click();
    await app.page.keyboard.type('[[Target Note]] ');

    // Click the rendered wiki-link span
    await editorBody.locator('span.wiki-link').click();

    // Editor should now show the target note
    await expect(app.editorTitle).toHaveValue('Target Note');
  });

  test('clicking a [[wiki-link]] for a non-existent note does nothing', async ({ app }) => {
    await app.seed([{ title: 'Only Note' }]);
    await app.goto();

    await app.noteItem('Only Note').click();

    // Type a link to a note that does not exist
    const editorBody = app.page.getByTestId('editor-body');
    await editorBody.click();
    await app.page.keyboard.type('[[Ghost Note]] ');

    // Click the broken wiki-link — should not crash or navigate away
    await editorBody.locator('span.wiki-link').click();

    // Still on the original note
    await expect(app.editorTitle).toHaveValue('Only Note');
  });
});
