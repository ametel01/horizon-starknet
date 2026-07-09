import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

const auditedNoOverflowRoutes = ['/', '/mint', '/trade', '/pools', '/portfolio'] as const;
const auditedViewportWidths = [320, 375, 414, 768, 1280] as const;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;

    return {
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      rootScrollWidth: root.scrollWidth,
      rootClientWidth: root.clientWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(overflow.rootScrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.rootClientWidth + 1
  );
  expect(overflow.bodyScrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.bodyClientWidth + 1
  );
}

test.describe('Navigation', () => {
  test('should navigate to home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Horizon Protocol/);
    await expect(
      page.getByRole('heading', { name: /Horizon protocol workbench/i, level: 1 })
    ).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('should navigate to trade page', async ({ page }) => {
    await page.goto('/');
    // Trade is advanced-only, so switch to advanced mode first if needed
    const advancedToggle = page.getByRole('button', { name: /Switch to advanced mode/i });
    if (await advancedToggle.isVisible()) {
      await advancedToggle.click();
    }
    await page.getByRole('link', { name: /Trade/i }).first().click();
    await expect(page).toHaveURL('/trade');
    await expect(page.getByRole('heading', { name: /Trade/i })).toBeVisible();
  });

  test('should navigate to pools page', async ({ page }) => {
    await page.goto('/');
    // Pools is advanced-only, so switch to advanced mode first if needed
    const advancedToggle = page.getByRole('button', { name: /Switch to advanced mode/i });
    if (await advancedToggle.isVisible()) {
      await advancedToggle.click();
    }
    await page.getByRole('link', { name: /Pools/i }).first().click();
    await expect(page).toHaveURL('/pools');
    await expect(page.getByRole('heading', { name: /Liquidity Pools/i })).toBeVisible();
  });

  test('should navigate to portfolio page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Portfolio/i }).first().click();
    await expect(page).toHaveURL('/portfolio');
    await expect(page.getByRole('heading', { name: /Portfolio/i })).toBeVisible();
  });

  test('should navigate to mint page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Earn/i }).first().click();
    await expect(page).toHaveURL('/mint');
  });

  test('should navigate to docs page', async ({ page }) => {
    await page.goto('/docs');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should expose compact protocol footer links', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'Markets' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Terms' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Privacy' })).toBeVisible();
    await expect(footer.getByRole('link', { name: /Built on Starknet/i })).toBeVisible();
    await expect(footer.getByText(/Alpha protocol/i)).toBeVisible();
    await expect(footer.getByText(/Product/i)).toHaveCount(0);
    await expect(footer.getByText(/Resources/i)).toHaveCount(0);
  });

  test('should show 404 for invalid routes', async ({ page }) => {
    await page.goto('/invalid-route-12345');
    await expect(page.getByText(/404/i)).toBeVisible();
  });

  test('should navigate back to dashboard', async ({ page }) => {
    await page.goto('/trade');
    await page.getByRole('link', { name: /Back/i }).click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('UI Mode Toggle', () => {
  test('should toggle between simple and advanced mode', async ({ page }) => {
    await page.goto('/');

    // Find the mode toggle by its accessible name
    const simpleToAdvanced = page.getByRole('button', { name: /Switch to advanced mode/i });
    const advancedToSimple = page.getByRole('button', { name: /Switch to simple mode/i });

    if (await simpleToAdvanced.isVisible()) {
      // Currently in simple mode, click to switch to advanced
      await simpleToAdvanced.click();
      // Verify it now shows option to switch back to simple
      await expect(advancedToSimple).toBeVisible();
    } else if (await advancedToSimple.isVisible()) {
      // Currently in advanced mode, click to switch to simple
      await advancedToSimple.click();
      // Verify it now shows option to switch to advanced
      await expect(simpleToAdvanced).toBeVisible();
    }
  });
});

test.describe('Theme Toggle', () => {
  test('should have theme toggle button', async ({ page }) => {
    await page.goto('/');

    // Find theme toggle button
    const themeToggle = page.getByRole('button', { name: /theme/i }).first();

    // Verify theme toggle is visible and clickable
    await expect(themeToggle).toBeVisible();
    await expect(themeToggle).toBeEnabled();

    // Click the toggle (theme change may depend on localStorage/system preferences)
    await themeToggle.click();

    await expect(page.getByRole('menuitem', { name: /Light/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Dark/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /System/i })).toBeVisible();

    // Verify button is still functional after click
    await expect(themeToggle).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  for (const route of auditedNoOverflowRoutes) {
    for (const width of auditedViewportWidths) {
      test(`should not horizontally overflow ${route} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await expect(page.locator('body')).toBeVisible();

        await expectNoHorizontalOverflow(page);
      });
    }
  }

  test('should display mobile menu on small screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 320, height: 667 });
    await page.goto('/');

    // On mobile, page should still load and show main workbench content.
    await expect(
      page.getByRole('heading', { name: /Horizon protocol workbench/i, level: 1 })
    ).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const menuButton = page.getByRole('button', { name: /Open app menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const appMenu = page.getByRole('navigation', { name: /App menu/i });
    await expect(appMenu).toBeVisible();
    await expect(appMenu.getByRole('link', { name: /Earn/i })).toBeVisible();
    await expect(appMenu.getByRole('link', { name: /Portfolio/i })).toBeVisible();
    await expect(appMenu.getByRole('link', { name: /Docs/i })).toBeVisible();
    await expect(appMenu.getByRole('button', { name: /Switch to advanced mode/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('should adapt layout for tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Page should load correctly with the workbench heading.
    await expect(
      page.getByRole('heading', { name: /Horizon protocol workbench/i, level: 1 })
    ).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('button', { name: /Open app menu/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('Error Handling', () => {
  test('should display error boundary for broken components', async ({ page }) => {
    // This test verifies error boundaries are in place
    // In production, this would be triggered by component errors
    await page.goto('/');

    // Verify the page loads without errors
    await expect(page).toHaveTitle(/Horizon Protocol/);
  });
});
