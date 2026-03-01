/**
 * Graph empty-state text and SVG node-label tests.
 * Complements spec 10 (basic graph) and spec 49 (toolbar controls) — neither
 * tests the exact empty-state message text or the <text> label elements D3
 * renders for each node.
 */
import { test, expect } from '../fixtures';

test.describe('Graph Empty State and Node Labels', () => {
  test('graph-empty element contains "No connections found" text', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();

    await expect(app.page.getByTestId('graph-empty')).toContainText('No connections found');
  });

  test('graph-empty element mentions [[Note Title]] wiki-link syntax', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();

    await expect(app.page.getByTestId('graph-empty')).toContainText('[[Note Title]]');
  });

  test('graph-empty element contains "Link notes using" instruction', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();

    await expect(app.page.getByTestId('graph-empty')).toContainText('Link notes using');
  });

  test('SVG has one <text> label element per seeded note', async ({ app }) => {
    await app.seed([
      { title: 'Label Alpha' },
      { title: 'Label Beta' },
      { title: 'Label Gamma' },
    ]);
    await app.goto();
    await app.navGraph.click();

    const svg = app.page.getByTestId('graph-svg');
    // D3 renders a <text> element for each node label
    await expect(svg.locator('text')).toHaveCount(3);
  });

  test('SVG text label contains the note title', async ({ app }) => {
    await app.seed([{ title: 'Unique Graph Title' }]);
    await app.goto();
    await app.navGraph.click();

    const svg = app.page.getByTestId('graph-svg');
    await expect(svg.locator('text').filter({ hasText: 'Unique Graph Title' })).toBeVisible();
  });

  test('single-note graph has exactly one <text> element', async ({ app }) => {
    await app.seed([{ title: 'Solo Node' }]);
    await app.goto();
    await app.navGraph.click();

    await expect(app.page.getByTestId('graph-svg').locator('text')).toHaveCount(1);
  });

  test('graph-empty element is not shown when notes are seeded', async ({ app }) => {
    await app.seed([{ title: 'Not Empty Graph' }]);
    await app.goto();
    await app.navGraph.click();

    await expect(app.page.getByTestId('graph-empty')).not.toBeVisible();
  });
});
