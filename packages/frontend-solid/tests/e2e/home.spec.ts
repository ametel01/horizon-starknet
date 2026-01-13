import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load home page with hero section', async ({ page }) => {
    await page.goto('/');

    // Verify page title contains Horizon
    await expect(page).toHaveTitle(/Horizon/i);

    // Hero h1 heading shows "Split Your Yield" (advanced) or "Earn Fixed Yield" (simple)
    await expect(
      page.getByRole('heading', { name: /(Split Your Yield|Earn Fixed Yield)/i, level: 1 })
    ).toBeVisible();
  });

  test('should display hero stats section', async ({ page }) => {
    await page.goto('/');

    // Check for stats labels in the hero section
    await expect(page.getByText(/Total Value Locked/i)).toBeVisible();
    await expect(page.getByText(/Active Markets/i)).toBeVisible();
  });

  test('should display markets section', async ({ page }) => {
    await page.goto('/');

    // Check for markets section heading
    await expect(
      page.getByRole('heading', { name: /(Active Markets|Earning Opportunities)/i })
    ).toBeVisible();

    // Check for analytics link
    await expect(page.getByRole('link', { name: /View Analytics/i })).toBeVisible();
  });

  test('should display feature cards section', async ({ page }) => {
    await page.goto('/');

    // Check for "What you can do" section
    await expect(page.getByRole('heading', { name: /What you can do/i })).toBeVisible();

    // Should have at least one feature card with a link
    const featureLinks = page.locator('a[href="/mint"], a[href="/trade"], a[href="/portfolio"]');
    await expect(featureLinks.first()).toBeVisible();
  });

  test('should have working CTA buttons', async ({ page }) => {
    await page.goto('/');

    // Find CTA buttons in hero section
    const mintButton = page.getByRole('link', { name: /(Mint PT \+ YT|Start Earning)/i });
    const tradeButton = page.getByRole('link', { name: /(Trade|View Markets)/i });

    await expect(mintButton).toBeVisible();
    await expect(tradeButton).toBeVisible();

    // Verify mint button navigates correctly
    await mintButton.click();
    await expect(page).toHaveURL('/mint');
  });

  test('should navigate to trade page from CTA', async ({ page }) => {
    await page.goto('/');

    const tradeButton = page.getByRole('link', { name: /(Trade|View Markets)/i });
    await tradeButton.click();
    await expect(page).toHaveURL('/trade');
  });
});

test.describe('Responsive Layout', () => {
  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Hero heading should still be visible
    await expect(
      page.getByRole('heading', { name: /(Split Your Yield|Earn Fixed Yield)/i, level: 1 })
    ).toBeVisible();

    // CTA buttons should be visible
    await expect(page.getByRole('link', { name: /(Mint PT \+ YT|Start Earning)/i })).toBeVisible();
  });

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Page should load correctly
    await expect(
      page.getByRole('heading', { name: /(Split Your Yield|Earn Fixed Yield)/i, level: 1 })
    ).toBeVisible();
  });
});
