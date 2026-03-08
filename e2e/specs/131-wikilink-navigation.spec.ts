/**
 * Wiki-link navigation and rendering tests.
 * Complements spec 39 (basic wiki-link navigation) and spec 112 (attributes)
 * by testing multi-link rendering, styling presence, and non-existent target
 * behavior with additional assertions.
 */
import { test, expect } from '../fixtures';

test.describe('Wiki-link Navigation', () => {
  test('wiki link renders with the wiki-link CSS class for special styling', async ({ app }) => {
    await app.seed([
      { title: 'Styled Source' },
      { title: 'Styled Target' },
    ]);
    await app.goto();
    await app.noteItem('Styled Source').click();

    const editorBody = app.page.getByTestId('editor-body');
    await editorBody.click();
    await app.page.keyboard.type('[[Styled Target]] ');

    const wikiLink = editorBody.locator('span.wiki-link');
    await expect(wikiLink).toBeVisible();
    await expect(wikiLink).toHaveClass(/wiki-link/);
  });

  test('clicking a wiki link navigates to the referenced note', async ({ app }) => {
    await app.seed([
      { title: 'Link Source' },
      { title: 'Link Destination' },
    ]);
    await app.goto();
    await app.noteItem('Link Source').click();

    const editorBody = app.page.getByTestId('editor-body');
    await editorBody.click();
    await app.page.keyboard.type('[[Link Destination]] ');

    await editorBody.locator('span.wiki-link').click();

    await expect(app.editorTitle).toHaveValue('Link Destination');
  });

  test('wiki link to non-existent note does not crash and stays on current note', async ({ app }) => {
    await app.seed([{ title: 'Orphan Source' }]);
    await app.goto();
    await app.noteItem('Orphan Source').click();

    const editorBody = app.page.getByTestId('editor-body');
    await editorBody.click();
    await app.page.keyboard.type('[[Does Not Exist]] ');

    // Click the broken wiki link
    await editorBody.locator('span.wiki-link').click();

    // Should remain on the original note without errors
    await expect(app.editorTitle).toHaveValue('Orphan Source');
    // The wiki link span should still be present (no crash)
    await expect(editorBody.locator('span.wiki-link')).toBeVisible();
  });

  test('multiple wiki links in the same note render correctly', async ({ app }) => {
    await app.seed([
      { title: 'Hub Note' },
      { title: 'Spoke A' },
      { title: 'Spoke B' },
      { title: 'Spoke C' },
    ]);
    await app.goto();
    await app.noteItem('Hub Note').click();

    const editorBody = app.page.getByTestId('editor-body');
    await editorBody.click();
    await app.page.keyboard.type('See [[Spoke A]] and [[Spoke B]] and [[Spoke C]] ');

    const links = editorBody.locator('span.wiki-link');
    await expect(links).toHaveCount(3);
    await expect(links.nth(0)).toContainText('Spoke A');
    await expect(links.nth(1)).toContainText('Spoke B');
    await expect(links.nth(2)).toContainText('Spoke C');
  });
});
