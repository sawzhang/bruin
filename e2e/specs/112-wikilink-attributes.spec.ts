/**
 * WikiLink DOM attribute tests: the WikiLink TipTap extension renders
 * `<span class="wiki-link" data-wiki-title="<title>">[[<title>]]</span>`.
 * Spec 39 tests toContainText() and toBeVisible() but never asserts:
 * - the `data-wiki-title` attribute value
 * - the text renders with double-bracket syntax `[[Title]]`
 * - multiple wiki-links in one note each have the correct data-wiki-title
 * Complements spec 39 (wiki-link navigation).
 */
import { test, expect } from '../fixtures';

async function typeWikiLink(
  app: import('../page-objects/AppPage').AppPage,
  linkTitle: string,
): Promise<void> {
  const editorBody = app.page.getByTestId('editor-body');
  await editorBody.click();
  await app.page.keyboard.type(`[[${linkTitle}]] `);
}

test.describe('WikiLink Attributes', () => {
  test('wiki-link span has data-wiki-title attribute matching the linked title', async ({ app }) => {
    await app.seed([
      { title: 'Source Note' },
      { title: 'Target Note' },
    ]);
    await app.goto();
    await app.noteItem('Source Note').click();

    await typeWikiLink(app, 'Target Note');

    await expect(
      app.page.getByTestId('editor-body').locator('span.wiki-link'),
    ).toHaveAttribute('data-wiki-title', 'Target Note');
  });

  test('wiki-link text renders with double-bracket syntax [[Title]]', async ({ app }) => {
    await app.seed([
      { title: 'Brackets Source' },
      { title: 'Brackets Target' },
    ]);
    await app.goto();
    await app.noteItem('Brackets Source').click();

    await typeWikiLink(app, 'Brackets Target');

    await expect(
      app.page.getByTestId('editor-body').locator('span.wiki-link'),
    ).toHaveText('[[Brackets Target]]');
  });

  test('two wiki-links each have their own data-wiki-title', async ({ app }) => {
    await app.seed([
      { title: 'Multi Link Source' },
      { title: 'First Target' },
      { title: 'Second Target' },
    ]);
    await app.goto();
    await app.noteItem('Multi Link Source').click();

    const editorBody = app.page.getByTestId('editor-body');
    await editorBody.click();
    await app.page.keyboard.type('[[First Target]] and [[Second Target]] ');

    const links = editorBody.locator('span.wiki-link');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('data-wiki-title', 'First Target');
    await expect(links.nth(1)).toHaveAttribute('data-wiki-title', 'Second Target');
  });

  test('wiki-link span has the "wiki-link" CSS class', async ({ app }) => {
    await app.seed([
      { title: 'CSS Class Source' },
      { title: 'CSS Class Target' },
    ]);
    await app.goto();
    await app.noteItem('CSS Class Source').click();

    await typeWikiLink(app, 'CSS Class Target');

    await expect(
      app.page.getByTestId('editor-body').locator('span.wiki-link'),
    ).toHaveClass(/wiki-link/);
  });

  test('wiki-link data-wiki-title is preserved even for a non-existent target', async ({ app }) => {
    await app.seed([{ title: 'Ghost Source Note' }]);
    await app.goto();
    await app.noteItem('Ghost Source Note').click();

    await typeWikiLink(app, 'Ghost Note');

    // Even broken links have the correct data-wiki-title attribute
    await expect(
      app.page.getByTestId('editor-body').locator('span.wiki-link'),
    ).toHaveAttribute('data-wiki-title', 'Ghost Note');
  });

  test('wiki-link text with spaces is preserved in data-wiki-title', async ({ app }) => {
    await app.seed([
      { title: 'Spaces Source' },
      { title: 'Multi Word Title' },
    ]);
    await app.goto();
    await app.noteItem('Spaces Source').click();

    await typeWikiLink(app, 'Multi Word Title');

    await expect(
      app.page.getByTestId('editor-body').locator('span.wiki-link'),
    ).toHaveAttribute('data-wiki-title', 'Multi Word Title');
  });
});
