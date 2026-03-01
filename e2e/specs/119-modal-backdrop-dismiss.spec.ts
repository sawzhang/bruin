/**
 * Modal backdrop dismissal tests: WorkflowBrowser and TemplatePicker both use
 * the same pattern — a fixed inset-0 wrapper with onClick={toggle} and an inner
 * div with e.stopPropagation(). Clicking the backdrop (outside the inner panel)
 * should close the modal. Neither spec 57 (workflow browser detail) nor spec 63
 * (template picker extra) nor spec 12 (basic templates) tests this dismissal
 * path; they only use the × button or Escape for closing.
 * Complements spec 57 and spec 63.
 */
import { test, expect } from '../fixtures';

async function openWorkflowBrowser(app: import('../page-objects/AppPage').AppPage) {
  await app.openCommandPalette();
  await app.page.getByTestId('command-palette-input').fill('>');
  await app.page.getByTestId('command-item').filter({ hasText: 'Run Workflow...' }).click();
  await expect(app.page.getByTestId('workflow-browser')).toBeVisible();
}

async function openTemplatePicker(app: import('../page-objects/AppPage').AppPage) {
  await app.openCommandPalette();
  await app.page.getByTestId('command-palette-input').fill('>');
  await app.page.getByTestId('command-item').filter({ hasText: 'New from Template' }).click();
  await expect(app.page.getByTestId('template-picker')).toBeVisible();
}

test.describe('Modal Backdrop Dismiss', () => {
  test('clicking the backdrop closes the workflow browser', async ({ app }) => {
    await app.goto();
    await openWorkflowBrowser(app);

    // Click outside the inner panel (top-left corner of the fixed overlay)
    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('workflow-browser')).not.toBeVisible();
  });

  test('clicking inside the workflow browser panel does not close it', async ({ app }) => {
    await app.goto();
    await openWorkflowBrowser(app);

    // Click on the heading text inside the panel
    await app.page.getByTestId('workflow-browser').getByText('Workflows').click();

    await expect(app.page.getByTestId('workflow-browser')).toBeVisible();
  });

  test('clicking the backdrop closes the template picker', async ({ app }) => {
    await app.goto();
    await openTemplatePicker(app);

    // Click outside the inner panel
    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('template-picker')).not.toBeVisible();
  });

  test('clicking inside the template picker panel does not close it', async ({ app }) => {
    await app.goto();
    await openTemplatePicker(app);

    // Click on the heading text inside the panel
    await app.page.getByTestId('template-picker').getByText('New from Template').click();

    await expect(app.page.getByTestId('template-picker')).toBeVisible();
  });

  test('workflow browser can be reopened after backdrop dismiss', async ({ app }) => {
    await app.goto();
    await openWorkflowBrowser(app);

    // Dismiss via backdrop
    await app.page.mouse.click(10, 10);
    await expect(app.page.getByTestId('workflow-browser')).not.toBeVisible();

    // Reopen
    await openWorkflowBrowser(app);
    await expect(app.page.getByTestId('workflow-browser')).toBeVisible();
  });

  test('template picker can be reopened after backdrop dismiss', async ({ app }) => {
    await app.goto();
    await openTemplatePicker(app);

    // Dismiss via backdrop
    await app.page.mouse.click(10, 10);
    await expect(app.page.getByTestId('template-picker')).not.toBeVisible();

    // Reopen
    await openTemplatePicker(app);
    await expect(app.page.getByTestId('template-picker')).toBeVisible();
  });
});
