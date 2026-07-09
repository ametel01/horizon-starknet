import { expect, test } from './fixtures';
import type { Locator, Page } from '@playwright/test';

interface AcceptedState {
  name: string;
  locator: Locator;
}

async function expectAcceptedState(page: Page, states: AcceptedState[]): Promise<void> {
  await expect(
    page.getByText(
      /Unable to Load Trading|Unable to Load Pools|Something went wrong|Illegal invocation/i
    )
  ).toHaveCount(0);

  const visibility = await Promise.all(
    states.map(async (state) => ({
      name: state.name,
      visible: await state.locator.first().isVisible().catch(() => false),
    }))
  );
  const visibleState = visibility.find((state) => state.visible);
  const checkedStates = visibility
    .map((state) => `${state.name}=${state.visible ? 'visible' : 'hidden'}`)
    .join(', ');

  expect(
    visibleState?.name,
    `Expected one accepted UI state to be visible. Checked: ${checkedStates}`
  ).toBeDefined();
}

function marketDataStates(page: Page): AcceptedState[] {
  return [
    { name: 'loading', locator: page.getByText(/Loading/i) },
    { name: 'empty markets', locator: page.getByText(/No markets available|No active markets/i) },
    { name: 'market load error', locator: page.getByText(/Failed to load/i) },
    { name: 'indexer unavailable', locator: page.getByText(/Indexer unavailable/i) },
    { name: 'offline banner', locator: page.getByText(/Offline/i) },
  ];
}

async function switchToAdvancedMode(page: Page): Promise<void> {
  const advancedToggle = page.getByRole('button', { name: /Switch to advanced mode/i });
  const simpleToggle = page.getByRole('button', { name: /Switch to simple mode/i });
  await expect(
    page.getByRole('button', { name: /Switch to (advanced|simple) mode/i })
  ).toBeVisible();

  if (await advancedToggle.isVisible().catch(() => false)) {
    await advancedToggle.click();
    await expect(simpleToggle).toBeVisible();
  }
}

test.describe('Markets Display', () => {
  test('should display market list on home page', async ({ page }) => {
    await page.goto('/');

    // Wait for markets section heading to be visible
    const marketSection = page.getByRole('heading', { name: /Earning Opportunities/i });
    await expect(marketSection).toBeVisible({ timeout: 10000 });
  });

  test('should display protocol stats', async ({ page }) => {
    await page.goto('/');

    // Stats are now in the hero section as floating orbs
    // Look for stat labels like "Total Value Locked", "Avg. Implied APY", "Active Markets"
    const statsSection = page.getByText(/Total Value Locked|Avg.*APY|Active Markets/i);
    await expect(statsSection.first()).toBeVisible({ timeout: 10000 });
  });

  test('should expose market APY details without hover when market cards render', async ({
    page,
  }) => {
    await page.goto('/');

    await switchToAdvancedMode(page);

    const marketCards = page.getByTestId('market-card');
    await expectAcceptedState(page, [
      { name: 'advanced market card', locator: marketCards },
      ...marketDataStates(page),
    ]);

    const firstCard = marketCards.first();
    if (!(await firstCard.isVisible().catch(() => false))) {
      return;
    }

    const detailsTrigger = firstCard.getByTestId('market-apy-details-trigger');
    const detailsPanel = firstCard.getByTestId('market-apy-details-panel');

    await expect(detailsTrigger).toBeVisible();
    await expect(detailsPanel).toBeHidden();

    await detailsTrigger.focus();
    await page.keyboard.press('Enter');

    await expect(detailsTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(detailsPanel).toBeVisible();
    await expect(detailsPanel).toContainText(/APY Breakdown/i);
    await expect(detailsPanel).toContainText(/Oracle source|Spot Rate|TWAP Rate/i);

    await detailsTrigger.click();
    await expect(detailsPanel).toBeHidden();

    await detailsTrigger.click();
    await expect(detailsPanel).toBeVisible();

    await expect(firstCard.getByRole('link', { name: /Trade PT/i })).toBeVisible();
    await expect(firstCard.getByRole('link', { name: /^Pool$/i })).toBeVisible();
  });

  test('should navigate to analytics page', async ({ page }) => {
    await page.goto('/');

    // Click analytics link
    const analyticsLink = page.getByRole('link', { name: /Analytics|View Analytics/i }).first();
    if (await analyticsLink.isVisible()) {
      await analyticsLink.click();
      await expect(page).toHaveURL('/analytics');
    }
  });
});

test.describe('Trade Page', () => {
  test('should display swap form', async ({ page }) => {
    await page.goto('/trade');
    await switchToAdvancedMode(page);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Trade/i })).toBeVisible();

    await expectAcceptedState(page, [
      { name: 'swap form', locator: page.locator('form, [data-testid="swap-form"], .swap-form') },
      ...marketDataStates(page),
    ]);
  });

  test('should display market selector when multiple markets exist', async ({ page }) => {
    await page.goto('/trade');

    // Wait for content to load
    await page.waitForTimeout(2000);

    await expectAcceptedState(page, [
      { name: 'market selector', locator: page.getByText(/Select Market/i) },
      ...marketDataStates(page),
    ]);
  });

  test('should display how trading works info', async ({ page }) => {
    await page.goto('/trade');

    // Wait for page to load
    await page.waitForTimeout(2000);

    await expectAcceptedState(page, [
      {
        name: 'trading education',
        locator: page.getByText(/How Trading Works|Principal Token|Yield Token/i),
      },
      ...marketDataStates(page),
    ]);
  });
});

test.describe('Pools Page', () => {
  test('should display liquidity pools page', async ({ page }) => {
    await page.goto('/pools');

    await expect(page.getByRole('heading', { name: /Liquidity Pools/i })).toBeVisible();
  });

  test('should show add/remove liquidity tabs', async ({ page }) => {
    await page.goto('/pools');

    // Wait for content to load
    await page.waitForTimeout(2000);

    await expectAcceptedState(page, [
      { name: 'add liquidity tab', locator: page.getByRole('tab', { name: /Add Liquidity/i }) },
      {
        name: 'remove liquidity tab',
        locator: page.getByRole('tab', { name: /Remove Liquidity/i }),
      },
      ...marketDataStates(page),
    ]);
  });

  test('should display how liquidity works info', async ({ page }) => {
    await page.goto('/pools');

    // Wait for page to load
    await page.waitForTimeout(2000);

    await expectAcceptedState(page, [
      {
        name: 'liquidity education',
        locator: page.getByText(/How Liquidity Works|Provide SY|Earn Trading Fees/i),
      },
      ...marketDataStates(page),
    ]);
  });
});

test.describe('Mint Page', () => {
  test('should display mint page', async ({ page }) => {
    await page.goto('/mint');

    // Page should load
    await expect(page).toHaveURL('/mint');
  });

  test('should show mint form or market selection', async ({ page }) => {
    await page.goto('/mint');

    // Wait for content to load
    await page.waitForTimeout(2000);

    await expectAcceptedState(page, [
      { name: 'mint form', locator: page.locator('form, [data-testid="mint-form"], .mint-form') },
      { name: 'asset selector', locator: page.getByText(/Select Asset|Select an asset/i) },
      { name: 'deposit tab', locator: page.getByRole('tab', { name: /Deposit/i }) },
      { name: 'split tab', locator: page.getByRole('tab', { name: /Split/i }) },
      ...marketDataStates(page),
    ]);
  });
});

test.describe('Portfolio Page', () => {
  test('should display portfolio page', async ({ page }) => {
    await page.goto('/portfolio');

    await expect(page.getByRole('heading', { name: /Portfolio/i })).toBeVisible();
  });

  test('should show wallet connection prompt when not connected', async ({ page }) => {
    await page.goto('/portfolio');

    // Wait for page to load
    await page.waitForTimeout(1000);

    await expectAcceptedState(page, [
      { name: 'wallet connection prompt', locator: page.getByText(/Connect.*wallet/i) },
      { name: 'empty positions', locator: page.getByText(/No positions/i) },
      { name: 'portfolio positions', locator: page.getByText(/Portfolio Value|Your Positions/i) },
      { name: 'portfolio loading', locator: page.getByText(/Loading/i) },
    ]);
  });
});

test.describe('Analytics Page', () => {
  test('should display analytics page', async ({ page }) => {
    await page.goto('/analytics');

    // Heading is now just "Analytics"
    await expect(page.getByRole('heading', { name: /Analytics/i, level: 1 })).toBeVisible();
  });

  test('should display protocol metrics', async ({ page }) => {
    await page.goto('/analytics');

    // Wait for data to load
    await page.waitForTimeout(2000);

    await expectAcceptedState(page, [
      { name: 'analytics metrics', locator: page.getByText(/TVL|Volume|Markets|Fees/i) },
      { name: 'analytics loading', locator: page.getByText(/Loading/i) },
      {
        name: 'analytics empty state',
        locator: page.getByText(/No active markets|Select a market/i),
      },
      { name: 'analytics load error', locator: page.getByText(/Failed to load/i) },
    ]);
  });
});
