/**
 * Wiki-links / knowledge graph edge tests
 */
import { test, expect } from '../fixtures';

test.describe('Wiki-links', () => {
  test('graph shows no edges when no note links exist', async ({ app }) => {
    await app.seed([
      { title: 'Note A' },
      { title: 'Note B' },
    ]);
    await app.goto();

    await app.navGraph.click();

    // No line elements = no edges
    await expect(app.page.locator('[data-testid="graph-svg"] line')).toHaveCount(0);
  });

  test('graph renders an edge when a noteLink is seeded', async ({ app }) => {
    await app.seed([
      { id: 'note-a', title: 'Alpha' },
      { id: 'note-b', title: 'Beta' },
    ]);
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.noteLinks.push(
        { source: 'note-a', target: 'note-b', link_type: 'wiki_link' },
      );
    });
    await app.goto();

    await app.navGraph.click();

    // One edge = one line element
    await expect(app.page.locator('[data-testid="graph-svg"] line')).toHaveCount(1);
  });

  test('graph renders multiple edges for multiple note links', async ({ app }) => {
    await app.seed([
      { id: 'note-x', title: 'X' },
      { id: 'note-y', title: 'Y' },
      { id: 'note-z', title: 'Z' },
    ]);
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.noteLinks.push(
        { source: 'note-x', target: 'note-y', link_type: 'wiki_link' },
        { source: 'note-y', target: 'note-z', link_type: 'wiki_link' },
      );
    });
    await app.goto();

    await app.navGraph.click();

    await expect(app.page.locator('[data-testid="graph-svg"] line')).toHaveCount(2);
  });

  test('graph nodes and edges are both present when links exist', async ({ app }) => {
    await app.seed([
      { id: 'n1', title: 'Source Note' },
      { id: 'n2', title: 'Target Note' },
    ]);
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.noteLinks.push(
        { source: 'n1', target: 'n2', link_type: 'wiki_link' },
      );
    });
    await app.goto();

    await app.navGraph.click();

    await expect(app.page.locator('[data-testid="graph-svg"] circle')).toHaveCount(2);
    await expect(app.page.locator('[data-testid="graph-svg"] line')).toHaveCount(1);
  });
});
