/**
 * App launch & initial state tests
 * Verifies the core layout renders correctly on startup.
 */
import { test, expect } from '../fixtures';

test.describe('App Launch', () => {
  test('renders main layout with sidebar, note list, and editor', async ({ app }) => {
    await app.goto();

    await expect(app.sidebar).toBeVisible();
    await expect(app.noteList).toBeVisible();
    await expect(app.editorEmptyState).toBeVisible();
  });

  test('sidebar shows all navigation items', async ({ app }) => {
    await app.goto();

    await expect(app.navAllNotes).toBeVisible();
    await expect(app.navTrash).toBeVisible();
    await expect(app.navActivity).toBeVisible();
    await expect(app.navGraph).toBeVisible();
    await expect(app.navTasks).toBeVisible();
    await expect(app.navAgents).toBeVisible();
  });

  test('sidebar shows bruin title and action buttons', async ({ app }) => {
    await app.goto();

    await expect(app.sidebar.getByText('Bruin')).toBeVisible();
    await expect(app.newNoteBtn).toBeVisible();
    await expect(app.btnSettings).toBeVisible();
    await expect(app.btnThemes).toBeVisible();
  });

  test('empty note list shows empty state message', async ({ app }) => {
    await app.goto();

    await expect(app.noteListEmpty).toBeVisible();
  });

  test('sync status indicator is present', async ({ app }) => {
    await app.goto();

    await expect(app.syncStatus).toBeVisible();
    // Mock returns not-synced state (last_sync: null)
    await expect(app.page.getByTestId('sync-label')).toBeVisible();
  });

  test('theme CSS variables are applied to the layout', async ({ app }) => {
    await app.goto();

    const bg = await app.page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bear-bg').trim()
    );
    expect(bg.length).toBeGreaterThan(0);
  });

  test('note list shows seeded notes on load', async ({ app }) => {
    await app.seed([
      { title: 'Alpha Note', content: 'First note' },
      { title: 'Beta Note', content: 'Second note' },
    ]);
    await app.goto();

    await expect(app.noteItem('Alpha Note')).toBeVisible();
    await expect(app.noteItem('Beta Note')).toBeVisible();
  });
});
