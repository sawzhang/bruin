/**
 * Workflow browser tests: open, empty state, seeded workflows
 */
import { test, expect } from '../fixtures';

test.describe('Workflows', () => {
  test('"Run Workflow..." command is visible in command palette', async ({ app }) => {
    await app.goto();
    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');

    await expect(
      app.page.getByTestId('command-item').filter({ hasText: 'Run Workflow...' })
    ).toBeVisible();
  });

  test('selecting "Run Workflow..." opens the workflow browser', async ({ app }) => {
    await app.goto();
    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'Run Workflow...' }).click();

    await expect(app.page.getByTestId('workflow-browser')).toBeVisible();
  });

  test('workflow browser shows empty state when no workflows exist', async ({ app }) => {
    await app.goto();
    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'Run Workflow...' }).click();

    await expect(app.page.getByTestId('workflow-empty')).toBeVisible();
  });

  test('workflow browser closes when clicking the backdrop', async ({ app }) => {
    await app.goto();
    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'Run Workflow...' }).click();
    await expect(app.page.getByTestId('workflow-browser')).toBeVisible();

    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('workflow-browser')).not.toBeVisible();
  });

  test('seeded workflow template appears in the browser', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workflowTemplates.push({
        id: 'wf-1',
        name: 'Daily Standup',
        description: 'Generate a standup summary',
        category: 'daily',
        steps: [
          { order: 1, tool_name: 'list_notes', description: 'Fetch recent notes', params: {} },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'Run Workflow...' }).click();

    await expect(app.page.getByTestId('workflow-item').filter({ hasText: 'Daily Standup' })).toBeVisible();
    await expect(app.page.getByTestId('workflow-empty')).not.toBeVisible();
  });

  test('multiple seeded workflows are all listed', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.workflowTemplates.push(
        {
          id: 'wf-a',
          name: 'Research Summary',
          description: 'Summarize research notes',
          category: 'research',
          steps: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'wf-b',
          name: 'Project Kickoff',
          description: 'Start a new project',
          category: 'project',
          steps: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      );
    });
    await app.goto();
    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'Run Workflow...' }).click();

    await expect(app.page.getByTestId('workflow-item')).toHaveCount(2);
  });
});
