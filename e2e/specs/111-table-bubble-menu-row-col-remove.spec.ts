/**
 * Table bubble menu -Row and -Col button tests: spec 42 verifies that +Row,
 * +Col, and Del appear when the cursor is inside a table, but never checks
 * -Row or -Col. Both buttons are defined in MarkdownEditor.tsx alongside +Row
 * and +Col. Clicking them calls deleteRow() / deleteColumn().
 * Complements spec 42 (slash commands and table controls).
 */
import { test, expect } from '../fixtures';

async function insertTable(app: import('../page-objects/AppPage').AppPage) {
  await app.seed([{ title: 'Table Note' }]);
  await app.goto();
  await app.noteItem('Table Note').click();

  const editor = app.page.locator('.ProseMirror');
  await editor.click();
  await app.page.keyboard.type('/');
  await app.page.getByTestId('slash-cmd-table').click();

  // Type text in the first cell then select it to trigger the BubbleMenu
  const firstCell = editor.locator('td').first();
  await firstCell.click();
  await app.page.keyboard.type('x');
  await app.page.keyboard.press('Shift+Home');
  return editor;
}

test.describe('Table Bubble Menu Row/Col Remove', () => {
  test('"-Row" button is visible when cursor is inside a table', async ({ app }) => {
    await insertTable(app);

    await expect(app.page.getByRole('button', { name: '-Row', exact: true })).toBeVisible();
  });

  test('"-Col" button is visible when cursor is inside a table', async ({ app }) => {
    await insertTable(app);

    await expect(app.page.getByRole('button', { name: '-Col', exact: true })).toBeVisible();
  });

  test('all 5 table controls appear simultaneously (+Row, +Col, -Row, -Col, Del)', async ({
    app,
  }) => {
    await insertTable(app);

    await expect(app.page.getByRole('button', { name: '+Row', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: '+Col', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: '-Row', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: '-Col', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'Del', exact: true })).toBeVisible();
  });

  test('clicking "+Row" adds a row to the table', async ({
    app,
  }) => {
    const editor = await insertTable(app);

    const initialRowCount = await editor.locator('tr').count();

    // Add a row (BubbleMenu is already showing from insertTable's text selection)
    await app.page.getByRole('button', { name: '+Row', exact: true }).click();

    // Wait for the row to be added
    await expect(editor.locator('tr')).toHaveCount(initialRowCount + 1);
  });

  test('clicking "-Row" removes a row from the table', async ({
    app,
  }) => {
    const editor = await insertTable(app);

    const initialRowCount = await editor.locator('tr').count();

    // Remove a row (BubbleMenu is already showing from insertTable's text selection)
    await app.page.getByRole('button', { name: '-Row', exact: true }).click();

    // Wait for the row to be removed
    await expect(editor.locator('tr')).toHaveCount(initialRowCount - 1);
  });

  test('clicking "+Col" adds a column to the table', async ({
    app,
  }) => {
    const editor = await insertTable(app);

    const initialColCount = await editor.locator('tr').first().locator('td, th').count();

    // Add a column
    await app.page.getByRole('button', { name: '+Col', exact: true }).click();

    await expect(editor.locator('tr').first().locator('td, th')).toHaveCount(initialColCount + 1);
  });

  test('clicking "-Col" removes a column from the table', async ({
    app,
  }) => {
    const editor = await insertTable(app);

    const initialColCount = await editor.locator('tr').first().locator('td, th').count();

    // Remove a column
    await app.page.getByRole('button', { name: '-Col', exact: true }).click();

    await expect(editor.locator('tr').first().locator('td, th')).toHaveCount(initialColCount - 1);
  });
});
