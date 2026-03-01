/**
 * Workflow browser "project" and "general" category color tests: spec 57
 * already asserts "daily" → text-blue-400 and "research" → text-purple-400,
 * but never tests the remaining two entries in CATEGORY_COLORS:
 * - "project" → bg-green-500/20 text-green-400
 * - "general" → bg-gray-500/20 text-gray-400
 * Also tests an unknown category falls back to the "general" colour
 * (CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general).
 * Complements spec 57 (workflow browser detail).
 */
import { test, expect } from '../fixtures';

async function openWorkflowBrowser(app: import('../page-objects/AppPage').AppPage) {
  await app.openCommandPalette();
  await app.page.getByTestId('command-palette-input').fill('>');
  await app.page.getByTestId('command-item').filter({ hasText: 'Run Workflow...' }).click();
  await expect(app.page.getByTestId('workflow-browser')).toBeVisible();
}

function seedWorkflow(
  app: import('../page-objects/AppPage').AppPage,
  id: string,
  name: string,
  category: string,
) {
  return app.page.addInitScript(
    (args: { id: string; name: string; category: string }) => {
      window.__TAURI_MOCK_DB__.workflowTemplates.push({
        id: args.id,
        name: args.name,
        description: 'Test workflow',
        category: args.category,
        steps: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },
    { id, name, category },
  );
}

test.describe('Workflow Browser Category Colors', () => {
  test('"project" category badge has text-green-400 class', async ({ app }) => {
    await seedWorkflow(app, 'wf-proj-1', 'Project Kickoff', 'project');
    await app.goto();
    await openWorkflowBrowser(app);

    const item = app.page.getByTestId('workflow-item').filter({ hasText: 'Project Kickoff' });
    await expect(item.locator('span.text-green-400')).toBeVisible();
  });

  test('"project" category badge shows category text "project"', async ({ app }) => {
    await seedWorkflow(app, 'wf-proj-2', 'Project Review', 'project');
    await app.goto();
    await openWorkflowBrowser(app);

    const item = app.page.getByTestId('workflow-item').filter({ hasText: 'Project Review' });
    await expect(item.locator('span.text-green-400')).toHaveText('project');
  });

  test('"general" category badge has text-gray-400 class', async ({ app }) => {
    await seedWorkflow(app, 'wf-gen-1', 'General Workflow', 'general');
    await app.goto();
    await openWorkflowBrowser(app);

    const item = app.page.getByTestId('workflow-item').filter({ hasText: 'General Workflow' });
    await expect(item.locator('span.text-gray-400')).toBeVisible();
  });

  test('"general" category badge shows category text "general"', async ({ app }) => {
    await seedWorkflow(app, 'wf-gen-2', 'General Tasks', 'general');
    await app.goto();
    await openWorkflowBrowser(app);

    const item = app.page.getByTestId('workflow-item').filter({ hasText: 'General Tasks' });
    await expect(item.locator('span.text-gray-400')).toHaveText('general');
  });

  test('unknown category falls back to gray (text-gray-400) styling', async ({ app }) => {
    await seedWorkflow(app, 'wf-unknown', 'Custom Workflow', 'custom');
    await app.goto();
    await openWorkflowBrowser(app);

    // CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general → gray for unknown
    const item = app.page.getByTestId('workflow-item').filter({ hasText: 'Custom Workflow' });
    await expect(item.locator('span.text-gray-400')).toBeVisible();
  });

  test('all four known categories render distinct color badges', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      ['daily', 'research', 'project', 'general'].forEach((cat, i) => {
        window.__TAURI_MOCK_DB__.workflowTemplates.push({
          id: `wf-all-${i}`,
          name: `${cat} workflow`,
          description: '',
          category: cat,
          steps: [],
          created_at: now,
          updated_at: now,
        });
      });
    });
    await app.goto();
    await openWorkflowBrowser(app);

    // Each color class should appear exactly once
    await expect(app.page.locator('span.text-blue-400')).toHaveCount(1);
    await expect(app.page.locator('span.text-purple-400')).toHaveCount(1);
    await expect(app.page.locator('span.text-green-400')).toHaveCount(1);
    await expect(app.page.locator('span.text-gray-400')).toHaveCount(1);
  });
});
