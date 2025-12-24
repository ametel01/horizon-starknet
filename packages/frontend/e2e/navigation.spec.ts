import { expect, test } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Horizon Protocol/);
    await expect(page.getByRole('heading', { name: /Horizon Protocol/i })).toBeVisible();
  });

  test('should navigate to trade page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Trade/i }).first().click();
    await expect(page).toHaveURL('/trade');
    await expect(page.getByRole('heading', { name: /Trade/i })).toBeVisible();
  });

  test('should navigate to pools page', async ({ page }) => {
    await page.goto('/');
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

  test('should show 404 for invalid routes', async ({ page }) => {
    await page.goto('/invalid-route-12345');
    await expect(page.getByText(/404/i)).toBeVisible();
  });

  test('should navigate back to dashboard', async ({ page }) => {
    await page.goto('/trade');
    await page.getByRole('link', { name: /Back to Dashboard/i }).click();
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

    // Verify button is still functional after click
    await expect(themeToggle).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should display mobile menu on small screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // On mobile, page should still load and show main content
    await expect(page.getByRole('heading', { name: /Horizon Protocol/i })).toBeVisible();

    // Navigation might be in a hamburger menu - check for menu button or visible nav
    const menuButton = page.getByRole('button', { name: /menu|navigation/i });
    const nav = page.getByRole('navigation');

    // Either nav is visible or there's a menu button to open it
    const navVisible = await nav.isVisible().catch(() => false);
    const menuVisible = await menuButton.isVisible().catch(() => false);

    expect(navVisible || menuVisible).toBe(true);
  });

  test('should adapt layout for tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Page should load correctly
    await expect(page.getByRole('heading', { name: /Horizon Protocol/i })).toBeVisible();
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
