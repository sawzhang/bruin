/**
 * Workflow browser item content tests: heading, close button, workflow name,
 * description, category badge, and step list display.
 * Complements spec 23 (opening/empty/seeded count).
 */
import { test, expect } from '../fixtures';

async function openWorkflowBrowser(app: import('../page-objects/AppPage').AppPage) {
  await app.openCommandPalette();
  await app.page.getByTestId('command-palette-input').fill('>');
  await app.page.getByTestId('command-item').filter({ hasText: 'Run Workflow...' }).click();
  await expect(app.page.getByTestId('workflow-browser')).toBeVisible();
}

test.describe('Workflow Browser Detail', () => {
  test('workflow browser shows "Workflows" heading', async ({ app }) => {
    await app.goto();
    await openWorkflowBrowser(app);

    await expect(app.page.getByTestId('workflow-browser').getByText('Workflows')).toBeVisible();
  });

  test('workflow browser × button closes the browser', async ({ app }) => {
    await app.goto();
    await openWorkflowBrowser(app);

    await app.page.getByTestId('workflow-browser').getByRole('button', { name: '×' }).click();

    await expect(app.page.getByTestId('workflow-browser')).not.toBeVisible();
  });

  test('workflow item shows name', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workflowTemplates.push({
        id: 'wf-name', name: 'Morning Briefing', description: 'Daily summary',
        category: 'daily', steps: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await openWorkflowBrowser(app);

    await expect(app.page.getByTestId('workflow-item').filter({ hasText: 'Morning Briefing' })).toBeVisible();
  });

  test('workflow item shows description', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workflowTemplates.push({
        id: 'wf-desc', name: 'Research Workflow', description: 'Summarize and tag research notes',
        category: 'research', steps: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await openWorkflowBrowser(app);

    const item = app.page.getByTestId('workflow-item').filter({ hasText: 'Research Workflow' });
    await expect(item).toContainText('Summarize and tag research notes');
  });

  test('workflow item shows the category text in a badge', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workflowTemplates.push({
        id: 'wf-cat', name: 'Project Kickoff', description: 'Start a project',
        category: 'project', steps: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await openWorkflowBrowser(app);

    const item = app.page.getByTestId('workflow-item').filter({ hasText: 'Project Kickoff' });
    // Use regex anchors to avoid matching the title "Project Kickoff" (case-insensitive substring)
    await expect(item.locator('span').filter({ hasText: /^project$/ })).toBeVisible();
  });

  test('"daily" category badge uses blue styling', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workflowTemplates.push({
        id: 'wf-daily', name: 'Daily Standup', description: 'Generate standup',
        category: 'daily', steps: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await openWorkflowBrowser(app);

    const item = app.page.getByTestId('workflow-item').filter({ hasText: 'Daily Standup' });
    // "daily" category uses bg-blue-500/20 text-blue-400
    await expect(item.locator('span.text-blue-400')).toBeVisible();
    await expect(item.locator('span.text-blue-400')).toHaveText('daily');
  });

  test('"research" category badge uses purple styling', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workflowTemplates.push({
        id: 'wf-research', name: 'Deep Research', description: 'Research workflow',
        category: 'research', steps: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await openWorkflowBrowser(app);

    const item = app.page.getByTestId('workflow-item').filter({ hasText: 'Deep Research' });
    await expect(item.locator('span.text-purple-400')).toBeVisible();
  });

  test('workflow item shows step order number', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workflowTemplates.push({
        id: 'wf-steps', name: 'Multi-step Workflow', description: 'Has steps',
        category: 'general',
        steps: [
          { order: 1, tool_name: 'list_notes', description: 'Fetch all notes', params: {} },
          { order: 2, tool_name: 'create_note', description: 'Create summary note', params: {} },
        ],
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await openWorkflowBrowser(app);

    const item = app.page.getByTestId('workflow-item').filter({ hasText: 'Multi-step Workflow' });
    // Steps show order number in a circular badge
    await expect(item).toContainText('1');
    await expect(item).toContainText('2');
  });

  test('workflow item step shows description and tool_name', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workflowTemplates.push({
        id: 'wf-step-detail', name: 'Detailed Steps', description: 'Steps with info',
        category: 'general',
        steps: [
          { order: 1, tool_name: 'search_notes', description: 'Find relevant notes', params: {} },
        ],
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await openWorkflowBrowser(app);

    const item = app.page.getByTestId('workflow-item').filter({ hasText: 'Detailed Steps' });
    await expect(item).toContainText('Find relevant notes');
    // tool_name is shown in monospace font
    await expect(item.locator('span.font-mono')).toHaveText('search_notes');
  });

  test('workflow with no steps shows no step list', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workflowTemplates.push({
        id: 'wf-no-steps', name: 'Empty Steps', description: 'No steps configured',
        category: 'general', steps: [],
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await openWorkflowBrowser(app);

    const item = app.page.getByTestId('workflow-item').filter({ hasText: 'Empty Steps' });
    // No step number spans should be inside the item
    await expect(item.locator('span.rounded-full')).toHaveCount(0);
  });
});
