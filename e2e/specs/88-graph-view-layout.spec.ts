/**
 * Graph view layout-swap tests: graph-view replaces note-list-wrapper and
 * editor-wrapper when the knowledge graph is opened, and restores them on close.
 * Complements spec 10 (graph interactions) and spec 49 (graph toolbar)
 * — neither tests the layout swap between graph-view and the editor area.
 */
import { test, expect } from '../fixtures';

test.describe('Graph View Layout Swap', () => {
  test('graph-view is not visible on app load', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('graph-view')).not.toBeVisible();
  });

  test('note-list-wrapper is visible on app load', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-list-wrapper')).toBeVisible();
  });

  test('editor-wrapper is visible on app load', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('editor-wrapper')).toBeVisible();
  });

  test('graph-view is visible after nav-graph is clicked', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-graph').click();

    await expect(app.page.getByTestId('graph-view')).toBeVisible();
  });

  test('note-list-wrapper is not visible when graph view is open', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-graph').click();

    await expect(app.page.getByTestId('note-list-wrapper')).not.toBeVisible();
  });

  test('editor-wrapper is not visible when graph view is open', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-graph').click();

    await expect(app.page.getByTestId('editor-wrapper')).not.toBeVisible();
  });

  test('note-list-wrapper is restored after graph view is closed', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-graph').click();
    await expect(app.page.getByTestId('note-list-wrapper')).not.toBeVisible();

    // Toggle graph off by clicking nav-graph again
    await app.page.getByTestId('nav-graph').click();

    await expect(app.page.getByTestId('note-list-wrapper')).toBeVisible();
  });

  test('editor-wrapper is restored after graph view is closed', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-graph').click();
    await app.page.getByTestId('nav-graph').click();

    await expect(app.page.getByTestId('editor-wrapper')).toBeVisible();
  });

  test('graph-view disappears after nav-graph is toggled off', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-graph').click();
    await expect(app.page.getByTestId('graph-view')).toBeVisible();

    await app.page.getByTestId('nav-graph').click();

    await expect(app.page.getByTestId('graph-view')).not.toBeVisible();
  });
});
