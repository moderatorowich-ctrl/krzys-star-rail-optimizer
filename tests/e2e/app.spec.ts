import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';

const demoAccount = JSON.parse(
  readFileSync('packages/game-data/src/demo-account.generated.json', 'utf8'),
);

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve a loopback port.'));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function waitForReady(process: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.stdout || !process.stderr) {
      reject(new Error('Live fixture did not expose output pipes.'));
      return;
    }
    const timeout = setTimeout(() => reject(new Error('Live fixture timed out.')), 8_000);
    let stderr = '';
    process.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    process.stdout.on('data', (chunk) => {
      if (!String(chunk).includes('READY')) return;
      clearTimeout(timeout);
      resolve();
    });
    process.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Live fixture exited with ${code}: ${stderr}`));
    });
  });
}

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

test('relic table rows select the matching detail record', async ({ page }) => {
  await page.goto('/#relics');
  const rows = page.locator('.relic-table button.relic-row');
  expect(await rows.count()).toBeGreaterThan(1);
  await rows.nth(1).click();
  await expect(rows.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(rows.nth(0)).toHaveAttribute('aria-pressed', 'false');
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

test('live import exposes safe pairing and reconciliation controls', async ({ page }) => {
  await page.goto('/#data');
  await expect(page.getByRole('heading', { name: 'Live account import' })).toBeVisible();
  await page.getByLabel('Scanner pairing code').fill('ABCD-EFGH-JKLM');
  await page.getByText('Advanced safety and reconciliation').click();
  await page.getByLabel('Local WebSocket URL').fill('wss://example.com/ws');
  await page.getByText('Enable Live Import (Recommended)').click();
  await expect(page.getByText(/live import can connect only to a loopback/i)).toBeVisible();
  await expect(page.getByText("Update characters' equipped relics and Light Cones")).toBeVisible();
  await expect(page.getByText('Import Warp resources')).toBeVisible();
});

test('live import explains the browser local-network permission while unavailable', async ({
  page,
}) => {
  await page.goto('/#data');
  await page.getByLabel('Scanner pairing code').fill('ABCD-EFGH-JKLM');
  await page.getByText('Enable Live Import (Recommended)').click();
  await expect(page.getByText(/browser Local Network Access/i)).toBeVisible({ timeout: 5_000 });
});

test('browser pairs with the real scanner bridge and validates a snapshot', async ({ page }) => {
  const port = await availablePort();
  const pairingCode = 'TEST-LIVE-45AA';
  const fixture = spawn(
    'python',
    ['tests/fixtures/live_bridge_fixture.py', String(port), pairingCode],
    { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] },
  );
  fixture.stdin.end(JSON.stringify(demoAccount));
  try {
    await waitForReady(fixture);
    await page.goto('/#data');
    await page.getByLabel('Scanner pairing code').fill(pairingCode);
    await page.getByText('Advanced safety and reconciliation').click();
    await page.getByLabel('Local WebSocket URL').fill(`ws://127.0.0.1:${port}/ws`);
    await page.getByText('Enable Live Import (Recommended)').click();
    await expect(page.getByText(/scanner and browser are already in sync/i)).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    fixture.kill();
  }
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
  await expect(page.getByRole('combobox', { name: 'Character', exact: true })).toHaveValue(
    'fixture-1',
  );
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
  const previousCharacter = await page
    .getByRole('combobox', { name: 'Character', exact: true })
    .inputValue();
  await page.getByPlaceholder('9-digit UID').fill('800333171');
  await page.getByRole('button', { name: 'Import public showcase' }).click();
  await expect(page.getByText(/Unsupported showcase relic slot/)).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Character', exact: true })).toHaveValue(
    previousCharacter,
  );
});
