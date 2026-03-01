/**
 * Sidebar primary button direct testid tests: sidebar, new-note-btn,
 * btn-settings, btn-themes, and tag-tree — all used via AppPage aliases
 * in other specs but never asserted via getByTestId() directly.
 * Complements spec 01 (app launch, visibility) and spec 06 (theme change)
 * — neither uses direct testid assertions for these elements.
 */
import { test, expect } from '../fixtures';

test.describe('Sidebar Primary Buttons', () => {
  test('sidebar wrapper has data-testid="sidebar"', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('sidebar')).toBeVisible();
  });

  test('new-note-btn is visible via getByTestId', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('new-note-btn')).toBeVisible();
  });

  test('clicking new-note-btn shows the editor-title input', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('new-note-btn').click();

    await expect(app.page.getByTestId('editor-title')).toBeVisible();
  });

  test('clicking new-note-btn shows the editor-panel', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('new-note-btn').click();

    await expect(app.page.getByTestId('editor-panel')).toBeVisible();
  });

  test('btn-settings is visible via getByTestId', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('btn-settings')).toBeVisible();
  });

  test('clicking btn-settings opens the settings-panel', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('btn-settings').click();

    await expect(app.page.getByTestId('settings-panel')).toBeVisible();
  });

  test('btn-themes is visible via getByTestId', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('btn-themes')).toBeVisible();
  });

  test('clicking btn-themes opens the theme-picker', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('btn-themes').click();

    await expect(app.page.getByTestId('theme-picker')).toBeVisible();
  });

  test('tag-tree is visible via getByTestId when tags exist', async ({ app }) => {
    await app.seed([{ title: 'Tagged Note', tags: ['direct-tag'] }]);
    await app.goto();

    await expect(app.page.getByTestId('tag-tree')).toBeVisible();
  });

  test('tag-tree-empty is visible via getByTestId when no tags exist', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('tag-tree-empty')).toBeVisible();
  });
});
