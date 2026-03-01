/**
 * Knowledge graph view tests
 */
import { test, expect } from '../fixtures';

test.describe('Knowledge Graph', () => {
  test('clicking Knowledge Graph nav opens the graph view', async ({ app }) => {
    await app.goto();

    await app.navGraph.click();

    await expect(app.page.getByTestId('graph-view')).toBeVisible();
  });

  test('graph toolbar is visible with depth selector and center button', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();

    await expect(app.page.getByTestId('graph-toolbar')).toBeVisible();
    await expect(app.page.getByTestId('graph-depth-select')).toBeVisible();
    await expect(app.page.getByTestId('graph-center-btn')).toBeVisible();
  });

  test('graph shows empty state when no notes exist', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();

    await expect(app.page.getByTestId('graph-empty')).toBeVisible();
  });

  test('graph SVG renders circles when notes are seeded', async ({ app }) => {
    await app.seed([
      { title: 'Alpha', content: '' },
      { title: 'Beta', content: '' },
      { title: 'Gamma', content: '' },
    ]);
    await app.goto();
    await app.navGraph.click();

    const svg = app.page.getByTestId('graph-svg');
    await expect(svg).toBeVisible();

    // D3 creates circle elements for each node
    await expect(svg.locator('circle')).toHaveCount(3);
  });

  test('depth selector has options 1 through 5', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();

    const select = app.page.getByTestId('graph-depth-select');
    const options = select.locator('option');
    await expect(options).toHaveCount(5);
    await expect(options.first()).toHaveText('1');
    await expect(options.last()).toHaveText('5');
  });

  test('clicking center button re-renders the graph', async ({ app }) => {
    await app.seed([{ title: 'A Note' }]);
    await app.goto();
    await app.navGraph.click();

    // Click center — should not throw, graph still visible
    await app.page.getByTestId('graph-center-btn').click();
    await expect(app.page.getByTestId('graph-svg')).toBeVisible();
  });

  test('clicking Knowledge Graph nav again closes the graph view', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();
    await expect(app.page.getByTestId('graph-view')).toBeVisible();

    // Toggling graph nav off restores note list
    await app.navGraph.click();
    await expect(app.page.getByTestId('note-list-wrapper')).toBeVisible();
    await expect(app.page.getByTestId('graph-view')).not.toBeVisible();
  });
});
