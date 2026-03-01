/**
 * Graph toolbar control tests: depth selector value and changes,
 * max-nodes slider display, center button, and toolbar visibility.
 * Complements spec 10 (basic graph view) and 26 (graph interaction).
 */
import { test, expect } from '../fixtures';

test.describe('Graph Toolbar Controls', () => {
  test('depth selector default value is 2', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();

    await expect(app.page.getByTestId('graph-depth-select')).toHaveValue('2');
  });

  test('changing depth to 1 keeps graph view visible', async ({ app }) => {
    await app.seed([{ title: 'Depth Test Note' }]);
    await app.goto();
    await app.navGraph.click();

    await app.page.getByTestId('graph-depth-select').selectOption('1');

    await expect(app.page.getByTestId('graph-svg')).toBeVisible();
    await expect(app.page.getByTestId('graph-depth-select')).toHaveValue('1');
  });

  test('changing depth to 5 keeps graph view visible', async ({ app }) => {
    await app.seed([{ title: 'Deep Depth Note' }]);
    await app.goto();
    await app.navGraph.click();

    await app.page.getByTestId('graph-depth-select').selectOption('5');

    await expect(app.page.getByTestId('graph-svg')).toBeVisible();
    await expect(app.page.getByTestId('graph-depth-select')).toHaveValue('5');
  });

  test('max nodes slider default display shows 200', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();

    // The span next to the range slider shows the current maxNodes value
    const toolbar = app.page.getByTestId('graph-toolbar');
    await expect(toolbar.locator('span.w-8')).toHaveText('200');
  });

  test('adjusting max nodes slider updates the displayed value', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();

    const toolbar = app.page.getByTestId('graph-toolbar');
    const slider = toolbar.locator('input[type="range"]');

    await slider.fill('50');

    await expect(toolbar.locator('span.w-8')).toHaveText('50');
  });

  test('"Center on note" button has the expected label', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();

    await expect(app.page.getByTestId('graph-center-btn')).toHaveText('Center on note');
  });

  test('graph toolbar is visible even when no notes exist (empty graph state)', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();

    // Empty graph still shows toolbar + empty message
    await expect(app.page.getByTestId('graph-toolbar')).toBeVisible();
    await expect(app.page.getByTestId('graph-empty')).toBeVisible();
  });

  test('depth selector options are 1, 2, 3, 4, 5', async ({ app }) => {
    await app.goto();
    await app.navGraph.click();

    const options = app.page.getByTestId('graph-depth-select').locator('option');
    await expect(options).toHaveCount(5);

    for (const [i, val] of (['1', '2', '3', '4', '5'] as const).entries()) {
      await expect(options.nth(i)).toHaveText(val);
    }
  });

  test('center button click does not crash with seeded notes', async ({ app }) => {
    await app.seed([{ title: 'Center Test' }, { title: 'Center Test 2' }]);
    await app.goto();
    await app.navGraph.click();

    await app.page.getByTestId('graph-center-btn').click();

    // Graph stays visible after center click
    await expect(app.page.getByTestId('graph-svg')).toBeVisible();
    await expect(app.page.getByTestId('graph-svg').locator('circle')).toHaveCount(2);
  });
});
