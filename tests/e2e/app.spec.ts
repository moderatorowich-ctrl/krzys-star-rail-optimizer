import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('dashboard exposes version and calculated recommendations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Supports Honkai: Star Rail v4.5')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rank the next account move.' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Prioritized account improvements' })).toBeVisible();
});

test('optimizer runs in a worker and produces a build', async ({ page }) => {
  await page.goto('/#optimizer');
  await page.getByRole('button', { name: 'Run optimizer' }).click();
  await expect(page.getByText('Top result')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Why it ranks first')).toBeVisible();
});

test('core views have no serious accessibility violations', async ({ page }) => {
  for (const route of [
    'dashboard',
    'optimizer',
    'teams',
    'relics',
    'planner',
    'timeline',
    'assistant',
    'history',
    'data',
    'settings',
  ]) {
    await page.goto(`/#${route}`);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((violation) =>
        ['critical', 'serious'].includes(violation.impact ?? ''),
      ),
      `Accessibility violations in #${route}`,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
      `Horizontal overflow in #${route}`,
    ).toBeLessThanOrEqual(1);
  }
});

test('mobile navigation remains usable', async ({ page }) => {
  await page.goto('/#assistant');
  await expect(
    page.getByRole('heading', { name: 'Ask your inventory, not the internet.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /What is my weakest built character/ }),
  ).toBeVisible();
});

test('public showcase import validates and replaces local account data', async ({ page }) => {
  await page.route('https://api.mihomo.me/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        player: { nickname: 'Anonymous fixture' },
        characters: [
          {
            id: 'fixture-1',
            name: 'Fixture Character',
            level: 80,
            promotion: 6,
            rank: 0,
            path: { name: 'Harmony' },
            element: { name: 'Wind' },
            attributes: [
              { field: 'hp', value: 1000 },
              { field: 'atk', value: 600 },
              { field: 'def', value: 500 },
              { field: 'spd', value: 100 },
            ],
            skills: [
              { type_text: 'Basic ATK', level: 6 },
              { type_text: 'Skill', level: 10 },
              { type_text: 'Ultimate', level: 10 },
              { type_text: 'Talent', level: 10 },
            ],
            skill_trees: [],
            relics: [],
          },
        ],
      }),
    }),
  );
  await page.goto('/#data');
  await page.getByPlaceholder('9-digit UID').fill('800333171');
  await page.getByRole('button', { name: 'Import public showcase' }).click();
  await expect(page.getByText('Imported 1 public showcase characters')).toBeVisible();
  await expect(page.getByLabel('Character')).toHaveValue('fixture-1');
});

test('malformed public showcase data fails closed without replacing the account', async ({
  page,
}) => {
  await page.route('https://api.mihomo.me/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        characters: [
          {
            id: 'malformed',
            name: 'Malformed fixture',
            level: 80,
            promotion: 6,
            rank: 0,
            path: { name: 'Harmony' },
            element: { name: 'Wind' },
            attributes: [
              { field: 'hp', value: 1000 },
              { field: 'atk', value: 600 },
              { field: 'def', value: 500 },
              { field: 'spd', value: 100 },
            ],
            skills: [],
            skill_trees: [],
            relics: [{ id: 'bad-slot', type: 99 }],
          },
        ],
      }),
    }),
  );
  await page.goto('/#data');
  const previousCharacter = await page.getByLabel('Character').inputValue();
  await page.getByPlaceholder('9-digit UID').fill('800333171');
  await page.getByRole('button', { name: 'Import public showcase' }).click();
  await expect(page.getByText(/Unsupported showcase relic slot/)).toBeVisible();
  await expect(page.getByLabel('Character')).toHaveValue(previousCharacter);
});
