/**
 * Templates picker tests: open, empty state, select template, create note
 */
import { test, expect } from '../fixtures';

test.describe('Templates', () => {
  test('command palette has a "New from Template" command', async ({ app }) => {
    await app.goto();

    const palette = await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');

    await expect(
      palette.getByTestId('command-item').filter({ hasText: 'New from Template' })
    ).toBeVisible();
  });

  test('selecting "New from Template" opens the template picker', async ({ app }) => {
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'New from Template' }).click();

    await expect(app.page.getByTestId('template-picker')).toBeVisible();
  });

  test('template picker shows empty state when no templates exist', async ({ app }) => {
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'New from Template' }).click();

    await expect(app.page.getByTestId('template-empty')).toBeVisible();
  });

  test('template picker lists seeded templates', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.templates.push(
        { id: 'tpl-1', name: 'Meeting Notes', description: 'Template for meetings', tags: ['meeting'], content: '## Agenda\n\n## Notes' },
        { id: 'tpl-2', name: 'Daily Journal', description: 'Daily journaling template', tags: ['journal'], content: '## Today\n\n## Goals' },
      );
    });
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'New from Template' }).click();

    await expect(app.page.getByTestId('template-option')).toHaveCount(2);
    await expect(app.page.getByTestId('template-option').filter({ hasText: 'Meeting Notes' })).toBeVisible();
    await expect(app.page.getByTestId('template-option').filter({ hasText: 'Daily Journal' })).toBeVisible();
  });

  test('selecting a template creates a note and opens it in the editor', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.templates.push(
        { id: 'tpl-meeting', name: 'Meeting Notes', description: 'For meetings', tags: [], content: '## Agenda' },
      );
    });
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'New from Template' }).click();

    await app.page.getByTestId('template-option').filter({ hasText: 'Meeting Notes' }).click();

    // Template picker closes and the new note opens in the editor
    await expect(app.page.getByTestId('template-picker')).not.toBeVisible();
    await expect(app.editorPanel).toBeVisible();
    await expect(app.editorTitle).toHaveValue('Meeting Notes');
  });

  test('note created from template contains template content', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.templates.push(
        { id: 'tpl-content', name: 'Content Template', description: '', tags: [], content: '## Section One' },
      );
    });
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'New from Template' }).click();
    await app.page.getByTestId('template-option').filter({ hasText: 'Content Template' }).click();

    await expect(app.page.locator('.ProseMirror')).toContainText('Section One');
  });

  test('template picker closes when clicking the backdrop', async ({ app }) => {
    await app.goto();

    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'New from Template' }).click();
    await expect(app.page.getByTestId('template-picker')).toBeVisible();

    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('template-picker')).not.toBeVisible();
  });
});
