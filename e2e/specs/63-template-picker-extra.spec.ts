/**
 * Template picker extra tests: heading text, template description, tag badges,
 * data-template-id attribute, and multiple-template scenarios.
 * Complements spec 12 (basic template open/select/create).
 */
import { test, expect } from '../fixtures';

async function openTemplatePicker(app: import('../page-objects/AppPage').AppPage) {
  await app.openCommandPalette();
  await app.page.getByTestId('command-palette-input').fill('>');
  await app.page.getByTestId('command-item').filter({ hasText: 'New from Template' }).click();
  await expect(app.page.getByTestId('template-picker')).toBeVisible();
}

test.describe('Template Picker Extra', () => {
  test('template picker shows "New from Template" heading', async ({ app }) => {
    await app.goto();
    await openTemplatePicker(app);

    await expect(
      app.page.getByTestId('template-picker').getByText('New from Template'),
    ).toBeVisible();
  });

  test('template option shows description text', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.templates.push({
        id: 'tpl-desc-test',
        name: 'Standup Template',
        description: 'Use this for daily standups',
        tags: [],
        content: '## Yesterday\n## Today',
      });
    });
    await app.goto();
    await openTemplatePicker(app);

    const option = app.page.getByTestId('template-option').filter({ hasText: 'Standup Template' });
    await expect(option).toContainText('Use this for daily standups');
  });

  test('template option shows tag badges', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.templates.push({
        id: 'tpl-tags-test',
        name: 'Tagged Template',
        description: 'Has tags',
        tags: ['meeting', 'weekly'],
        content: '',
      });
    });
    await app.goto();
    await openTemplatePicker(app);

    const option = app.page.getByTestId('template-option').filter({ hasText: 'Tagged Template' });
    await expect(option.locator('span', { hasText: 'meeting' })).toBeVisible();
    await expect(option.locator('span', { hasText: 'weekly' })).toBeVisible();
  });

  test('template option has data-template-id matching the template id', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.templates.push({
        id: 'tpl-attr-check',
        name: 'Attr Check Template',
        description: '',
        tags: [],
        content: '',
      });
    });
    await app.goto();
    await openTemplatePicker(app);

    const option = app.page.getByTestId('template-option').filter({ hasText: 'Attr Check Template' });
    await expect(option).toHaveAttribute('data-template-id', 'tpl-attr-check');
  });

  test('template option with no tags shows no badge spans', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.templates.push({
        id: 'tpl-no-tags',
        name: 'No Tags Template',
        description: 'No tags here',
        tags: [],
        content: '',
      });
    });
    await app.goto();
    await openTemplatePicker(app);

    const option = app.page.getByTestId('template-option').filter({ hasText: 'No Tags Template' });
    // The tag container div renders nothing when tags is empty
    await expect(option.getByText('meeting')).not.toBeVisible();
    await expect(option.getByText('weekly')).not.toBeVisible();
  });

  test('two templates from the same category both show as separate options', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.templates.push(
        { id: 'tpl-pair-1', name: 'Template Alpha', description: 'First', tags: ['a'], content: '' },
        { id: 'tpl-pair-2', name: 'Template Beta',  description: 'Second', tags: ['b'], content: '' },
      );
    });
    await app.goto();
    await openTemplatePicker(app);

    await expect(app.page.getByTestId('template-option').filter({ hasText: 'Template Alpha' })).toBeVisible();
    await expect(app.page.getByTestId('template-option').filter({ hasText: 'Template Beta' })).toBeVisible();
    await expect(app.page.getByTestId('template-option')).toHaveCount(2);
  });

  test('template option shows the template name in a prominent font-medium element', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.templates.push({
        id: 'tpl-name-style',
        name: 'Styled Name Template',
        description: 'Check the name styling',
        tags: [],
        content: '',
      });
    });
    await app.goto();
    await openTemplatePicker(app);

    const option = app.page.getByTestId('template-option').filter({ hasText: 'Styled Name Template' });
    // Name is in a div.font-medium element
    await expect(option.locator('div.font-medium')).toHaveText('Styled Name Template');
  });
});
