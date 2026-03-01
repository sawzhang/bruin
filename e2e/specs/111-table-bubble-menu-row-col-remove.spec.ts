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
  await app.page.getByRole('button', { name: 'Table' }).click();

  // Click inside the first cell to position cursor in the table
  await editor.locator('td').first().click();
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

  test('clicking "+Row" then "-Row" returns the table to its original row count', async ({
    app,
  }) => {
    const editor = await insertTable(app);

    const initialRowCount = await editor.locator('tr').count();

    // Add a row
    await app.page.getByRole('button', { name: '+Row', exact: true }).click();
    await editor.locator('td').first().click();
    const afterAddCount = await editor.locator('tr').count();
    expect(afterAddCount).toBe(initialRowCount + 1);

    // Remove that row
    await app.page.getByRole('button', { name: '-Row', exact: true }).click();
    await editor.locator('td').first().click();
    const afterRemoveCount = await editor.locator('tr').count();
    expect(afterRemoveCount).toBe(initialRowCount);
  });

  test('clicking "+Col" then "-Col" returns the table to its original column count', async ({
    app,
  }) => {
    const editor = await insertTable(app);

    const initialColCount = await editor.locator('th, td').first().locator('..').locator('td, th').count();

    // Add a column
    await app.page.getByRole('button', { name: '+Col', exact: true }).click();
    await editor.locator('td').first().click();

    // Remove that column
    await app.page.getByRole('button', { name: '-Col', exact: true }).click();
    await editor.locator('td').first().click();

    const finalColCount = await editor.locator('th, td').first().locator('..').locator('td, th').count();
    expect(finalColCount).toBe(initialColCount);
  });
});
