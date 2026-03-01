/**
 * Nav panel active-state tests: nav-activity, nav-graph, nav-tasks, nav-agents
 * bg-bear-active when the corresponding panel is open, and sync-status wrapper.
 * Complements spec 82 (nav-all-notes and nav-trash active states)
 * — neither spec tests the panel nav buttons' active class directly.
 */
import { test, expect } from '../fixtures';

test.describe('Nav Panel Active States', () => {
  test('sync-status wrapper is visible in the sidebar footer', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('sync-status')).toBeVisible();
  });

  test('sync-status contains both sync-dot and sync-label', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('sync-status').getByTestId('sync-dot')).toBeVisible();
    await expect(app.page.getByTestId('sync-status').getByTestId('sync-label')).toBeVisible();
  });

  test('nav-activity has bg-bear-active class when activity panel is open', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-activity').click();

    await expect(app.page.getByTestId('nav-activity')).toHaveClass(/bg-bear-active/);
  });

  test('nav-activity loses bg-bear-active when activity panel is closed', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-activity').click();
    await expect(app.page.getByTestId('nav-activity')).toHaveClass(/bg-bear-active/);

    // Toggle off by clicking again
    await app.page.getByTestId('nav-activity').click();

    await expect(app.page.getByTestId('nav-activity')).not.toHaveClass(/bg-bear-active/);
  });

  test('nav-tasks has bg-bear-active class when task panel is open', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-tasks').click();

    await expect(app.page.getByTestId('nav-tasks')).toHaveClass(/bg-bear-active/);
  });

  test('nav-tasks loses bg-bear-active when task panel is closed', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-tasks').click();
    await expect(app.page.getByTestId('nav-tasks')).toHaveClass(/bg-bear-active/);

    await app.page.getByTestId('nav-tasks').click();

    await expect(app.page.getByTestId('nav-tasks')).not.toHaveClass(/bg-bear-active/);
  });

  test('nav-graph has bg-bear-active class when graph view is open', async ({ app }) => {
    await app.goto();
    await app.page.getByTestId('nav-graph').click();

    await expect(app.page.getByTestId('nav-graph')).toHaveClass(/bg-bear-active/);
  });

  test('nav-agents has bg-bear-active class when agent dashboard is open', async ({ app }) => {
    await app.goto();
    await app.navAgents.click();

    await expect(app.page.getByTestId('nav-agents')).toHaveClass(/bg-bear-active/);
  });
});
