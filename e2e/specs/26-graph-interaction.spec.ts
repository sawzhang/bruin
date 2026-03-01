/**
 * Knowledge graph interaction tests: node click, edge rendering
 */
import { test, expect } from '../fixtures';

test.describe('Graph Interaction', () => {
  test('clicking a graph node selects the note (visible after closing graph)', async ({ app }) => {
    await app.seed([{ title: 'Node Alpha' }]);
    await app.goto();

    await app.navGraph.click();

    const svg = app.page.getByTestId('graph-svg');
    await expect(svg.locator('circle')).toHaveCount(1);

    // Click the circle node — selectNote(id) is called internally
    await svg.locator('circle').first().click();

    // Close graph to reveal the editor panel
    await app.navGraph.click();

    // Editor should be visible with the selected note
    await expect(app.editorPanel).toBeVisible();
    await expect(app.editorTitle).toHaveValue('Node Alpha');
  });

  test('graph renders one circle per non-deleted note', async ({ app }) => {
    await app.seed([
      { title: 'Node One' },
      { title: 'Node Two' },
      { title: 'Node Three' },
    ]);
    await app.goto();
    await app.navGraph.click();

    await expect(app.page.getByTestId('graph-svg').locator('circle')).toHaveCount(3);
  });

  test('linked notes show an edge (line) between them in the graph', async ({ app }) => {
    await app.seed([
      { id: 'note-src', title: 'Source Note' },
      { id: 'note-tgt', title: 'Target Note' },
    ]);
    // Manually inject a note link into the mock DB
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.noteLinks.push({
        source: 'note-src',
        target: 'note-tgt',
        link_type: 'wiki_link',
      });
    });
    await app.goto();
    await app.navGraph.click();

    const svg = app.page.getByTestId('graph-svg');
    await expect(svg.locator('circle')).toHaveCount(2);
    // D3 renders a <line> element for each edge
    await expect(svg.locator('line')).toHaveCount(1);
  });
});
