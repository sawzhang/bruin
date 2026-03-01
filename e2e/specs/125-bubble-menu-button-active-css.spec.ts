/**
 * BubbleButton active state CSS tests: MarkdownEditor.tsx renders a BubbleButton
 * for each format mark. When active={true} the button gets "bg-bear-active text-bear-text";
 * when active={false} it gets "text-bear-text-secondary hover:...". Spec 41
 * (editor bubble menu) only asserts that marks are applied (e.g. <strong> is
 * visible) — it never calls toHaveClass() on the button itself.
 * Complements spec 41 (editor bubble menu).
 */
import { test, expect } from '../fixtures';

async function openNoteAndType(app: import('../page-objects/AppPage').AppPage, text: string) {
  await app.seed([{ title: 'Bubble CSS Note' }]);
  await app.goto();
  await app.noteItem('Bubble CSS Note').click();
  const editor = app.page.locator('.ProseMirror');
  await editor.click();
  await app.page.keyboard.type(text);
  return editor;
}

test.describe('Bubble Menu Button Active CSS', () => {
  test('B button has bg-bear-active class when bold is active', async ({ app }) => {
    const editor = await openNoteAndType(app, 'Bold text');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: 'B', exact: true }).click();

    // Re-select to keep bubble menu visible with bold active
    await editor.click({ clickCount: 3 });

    await expect(app.page.getByRole('button', { name: 'B', exact: true })).toHaveClass(
      /bg-bear-active/,
    );
  });

  test('I button has bg-bear-active class when italic is active', async ({ app }) => {
    const editor = await openNoteAndType(app, 'Italic text');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: 'I', exact: true }).click();
    await editor.click({ clickCount: 3 });

    await expect(app.page.getByRole('button', { name: 'I', exact: true })).toHaveClass(
      /bg-bear-active/,
    );
  });

  test('<> button has bg-bear-active class when inline code is active', async ({ app }) => {
    const editor = await openNoteAndType(app, 'Code text');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: '<>', exact: true }).click();
    await editor.click({ clickCount: 3 });

    await expect(app.page.getByRole('button', { name: '<>', exact: true })).toHaveClass(
      /bg-bear-active/,
    );
  });

  test('B button loses bg-bear-active after bold is toggled off', async ({ app }) => {
    const editor = await openNoteAndType(app, 'Toggle bold off');
    await editor.click({ clickCount: 3 });

    // Apply bold
    await app.page.getByRole('button', { name: 'B', exact: true }).click();
    await editor.click({ clickCount: 3 });
    await expect(app.page.getByRole('button', { name: 'B', exact: true })).toHaveClass(
      /bg-bear-active/,
    );

    // Remove bold
    await app.page.getByRole('button', { name: 'B', exact: true }).click();
    await editor.click({ clickCount: 3 });
    await expect(app.page.getByRole('button', { name: 'B', exact: true })).not.toHaveClass(
      /bg-bear-active/,
    );
  });

  test('inactive button does not have bg-bear-active class', async ({ app }) => {
    const editor = await openNoteAndType(app, 'Only bold');
    await editor.click({ clickCount: 3 });

    // Apply bold only — I should remain inactive
    await app.page.getByRole('button', { name: 'B', exact: true }).click();
    await editor.click({ clickCount: 3 });

    await expect(app.page.getByRole('button', { name: 'I', exact: true })).not.toHaveClass(
      /bg-bear-active/,
    );
  });

  test('H button has bg-bear-active when heading is active', async ({ app }) => {
    const editor = await openNoteAndType(app, 'Heading text');
    await editor.click({ clickCount: 3 });

    await app.page.getByRole('button', { name: 'H', exact: true }).click();
    await editor.click({ clickCount: 3 });

    await expect(app.page.getByRole('button', { name: 'H', exact: true })).toHaveClass(
      /bg-bear-active/,
    );
  });
});
