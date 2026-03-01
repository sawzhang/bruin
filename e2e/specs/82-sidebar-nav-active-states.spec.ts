/**
 * Sidebar nav active-state tests: sidebar-nav wrapper visibility, nav-all-notes
 * bg-bear-active class when active, nav-trash active when in trash view,
 * and deactivation when tag is selected.
 * Complements spec 03 (nav-all-notes click) and spec 04 (trash navigation)
 * — neither tests the active CSS class or the sidebar-nav wrapper.
 */
import { test, expect } from '../fixtures';

test.describe('Sidebar Nav Active States', () => {
  test('sidebar-nav wrapper is visible on app load', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('sidebar-nav')).toBeVisible();
  });

  test('nav-all-notes has bg-bear-active class on initial load', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('nav-all-notes')).toHaveClass(/bg-bear-active/);
  });

  test('nav-all-notes loses bg-bear-active when a tag is selected', async ({ app }) => {
    await app.seed([{ title: 'Tagged Note', tags: ['nav-test-tag'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'nav-test-tag' }).click();

    await expect(app.page.getByTestId('nav-all-notes')).not.toHaveClass(/bg-bear-active/);
  });

  test('nav-all-notes regains bg-bear-active after clicking All Notes', async ({ app }) => {
    await app.seed([{ title: 'Regain Note', tags: ['regain-tag'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'regain-tag' }).click();
    await expect(app.page.getByTestId('nav-all-notes')).not.toHaveClass(/bg-bear-active/);

    await app.navAllNotes.click();

    await expect(app.page.getByTestId('nav-all-notes')).toHaveClass(/bg-bear-active/);
  });

  test('nav-trash has bg-bear-active class when trash view is active', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-trash').click();

    await expect(app.page.getByTestId('nav-trash')).toHaveClass(/bg-bear-active/);
  });

  test('nav-trash loses bg-bear-active when All Notes is clicked', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-trash').click();
    await expect(app.page.getByTestId('nav-trash')).toHaveClass(/bg-bear-active/);

    await app.navAllNotes.click();

    await expect(app.page.getByTestId('nav-trash')).not.toHaveClass(/bg-bear-active/);
  });

  test('nav-all-notes does not have bg-bear-active when trash view is active', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-trash').click();

    await expect(app.page.getByTestId('nav-all-notes')).not.toHaveClass(/bg-bear-active/);
  });
});
