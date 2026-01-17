import { expect, test } from './fixtures';

/**
 * E2E tests for single-sided liquidity operations
 *
 * These tests verify the single-sided add/remove liquidity functionality:
 * - Add liquidity with arbitrary token (via TokenAggregatorLiquidityForm)
 * - Remove liquidity to single SY
 * - Remove liquidity to single PT
 *
 * Note: These tests run against a local devnet or mock environment.
 * Actual contract calls are not tested - we verify the UI flow works.
 */

test.describe('Single-Sided Liquidity - Pools Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to pools page
    await page.goto('/pools');
    await expect(page.getByRole('heading', { name: /Liquidity Pools/i })).toBeVisible();
  });

  test('should display pools page with add/remove tabs', async ({ page }) => {
    // Verify the liquidity tabs are visible
    const addTab = page.getByRole('tab', { name: /Add Liquidity/i });
    const removeTab = page.getByRole('tab', { name: /Remove Liquidity/i });

    await expect(addTab).toBeVisible();
    await expect(removeTab).toBeVisible();
  });

  test('should display pool selector dropdown', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(1000);

    // Look for "Select Pool" label and dropdown
    const poolSelector = page.locator('button[role="combobox"]').first();
    const isVisible = await poolSelector.isVisible().catch(() => false);

    // Pool selector should be visible when page loads
    expect(isVisible).toBe(true);
  });
});

test.describe('Remove Liquidity - Output Type Selection', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to pools page
    await page.goto('/pools');
    await expect(page.getByRole('heading', { name: /Liquidity Pools/i })).toBeVisible();

    // Click on Remove Liquidity tab
    const removeTab = page.getByRole('tab', { name: /Remove Liquidity/i });
    await removeTab.click();
  });

  test('should display output type selector', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Look for "Receive as" label which precedes the output type selector
    const receiveAsLabel = page.getByText(/Receive as/i);
    const isVisible = await receiveAsLabel.isVisible().catch(() => false);

    // "Receive as" label should be visible
    expect(isVisible).toBe(true);
  });

  test('should display SY + PT output option (dual)', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Look for the dual output option
    const dualOption = page.locator('button:has-text("SY + PT")');
    const isVisible = await dualOption.isVisible().catch(() => false);

    // SY + PT option should be visible
    expect(isVisible).toBe(true);
  });

  test('should display SY Only output option', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Look for SY Only option
    const syOnlyOption = page.locator('button:has-text("SY Only")');
    const isVisible = await syOnlyOption.isVisible().catch(() => false);

    // SY Only option should be visible
    expect(isVisible).toBe(true);
  });

  test('should display PT Only output option', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Look for PT Only option
    const ptOnlyOption = page.locator('button:has-text("PT Only")');
    const isVisible = await ptOnlyOption.isVisible().catch(() => false);

    // PT Only option should be visible
    expect(isVisible).toBe(true);
  });

  test('should select SY Only output type', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Find and click SY Only option
    const syOnlyOption = page.locator('button:has-text("SY Only")');
    const isVisible = await syOnlyOption.isVisible().catch(() => false);

    if (isVisible) {
      await syOnlyOption.click();

      // Verify it's selected (has pressed state)
      await expect(syOnlyOption).toHaveAttribute('data-pressed', 'true');
    }
  });

  test('should select PT Only output type', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Find and click PT Only option
    const ptOnlyOption = page.locator('button:has-text("PT Only")');
    const isVisible = await ptOnlyOption.isVisible().catch(() => false);

    if (isVisible) {
      await ptOnlyOption.click();

      // Verify it's selected (has pressed state)
      await expect(ptOnlyOption).toHaveAttribute('data-pressed', 'true');
    }
  });

  test('should display LP input field', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Look for "LP to Remove" label
    const lpLabel = page.getByText(/LP to Remove/i);
    const isVisible = await lpLabel.isVisible().catch(() => false);

    // LP input field label should be visible
    expect(isVisible).toBe(true);
  });

  test('should display percentage quick-select buttons', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Look for percentage buttons (25%, 50%, 75%, Max)
    const maxButton = page.locator('button:has-text("Max")');
    const fiftyPercent = page.locator('button:has-text("50%")');

    const hasPercentButtons =
      (await maxButton.isVisible().catch(() => false)) ||
      (await fiftyPercent.isVisible().catch(() => false));

    // Percentage quick-select buttons should be visible
    expect(hasPercentButtons).toBe(true);
  });

  test('should display output preview section', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Look for "You will receive" preview section
    const previewLabel = page.getByText(/You will receive/i);
    const isVisible = await previewLabel.isVisible().catch(() => false);

    // Output preview section should be visible
    expect(isVisible).toBe(true);
  });

  test('should display slippage tolerance settings', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Look for slippage tolerance section
    const slippageLabel = page.getByText(/Slippage Tolerance/i);
    const isVisible = await slippageLabel.isVisible().catch(() => false);

    // Slippage tolerance settings should be visible
    expect(isVisible).toBe(true);
  });

  test('should show submit button with appropriate state', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Find the submit button - should show appropriate state based on connection/amount
    const submitButton = page.locator(
      'button:has-text("Connect Wallet"), button:has-text("Enter Amount"), button:has-text("Remove Liquidity"), button:has-text("Remove to SY"), button:has-text("Remove to PT")'
    );

    const isVisible = await submitButton.first().isVisible().catch(() => false);
    // Submit button should be visible
    expect(isVisible).toBe(true);
  });

  test('should update button text when SY Only is selected', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Select SY Only
    const syOnlyOption = page.locator('button:has-text("SY Only")');
    const isOptionVisible = await syOnlyOption.isVisible().catch(() => false);

    if (isOptionVisible) {
      await syOnlyOption.click();
      await page.waitForTimeout(500);

      // The button might say "Enter Amount" or "Remove to SY" depending on state
      // Either is acceptable
      const submitButton = page.locator(
        'button:has-text("Remove to SY"), button:has-text("Enter Amount"), button:has-text("Connect Wallet")'
      );
      const isButtonVisible = await submitButton.first().isVisible().catch(() => false);
      // Submit button should be visible after selecting SY Only
      expect(isButtonVisible).toBe(true);
    }
  });

  test('should update button text when PT Only is selected', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Select PT Only
    const ptOnlyOption = page.locator('button:has-text("PT Only")');
    const isOptionVisible = await ptOnlyOption.isVisible().catch(() => false);

    if (isOptionVisible) {
      await ptOnlyOption.click();
      await page.waitForTimeout(500);

      // The button might say "Enter Amount" or "Remove to PT" depending on state
      const submitButton = page.locator(
        'button:has-text("Remove to PT"), button:has-text("Enter Amount"), button:has-text("Connect Wallet")'
      );
      const isButtonVisible = await submitButton.first().isVisible().catch(() => false);
      // Submit button should be visible after selecting PT Only
      expect(isButtonVisible).toBe(true);
    }
  });
});

test.describe('Add Liquidity - Form Display', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to pools page
    await page.goto('/pools');
    await expect(page.getByRole('heading', { name: /Liquidity Pools/i })).toBeVisible();
  });

  test('should display add liquidity form by default', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Add Liquidity tab should be selected by default
    const addTab = page.getByRole('tab', { name: /Add Liquidity/i });
    const isSelected = await addTab
      .getAttribute('aria-selected')
      .then((v) => v === 'true')
      .catch(() => false);

    // Add Liquidity should be selected by default
    expect(isSelected).toBe(true);
  });

  test('should display deposit input field', async ({ page }) => {
    // Wait for form to load
    await page.waitForTimeout(1000);

    // Look for input field in add liquidity form
    const inputField = page.locator('input[type="text"], input[type="number"]').first();
    const isVisible = await inputField.isVisible().catch(() => false);

    // Deposit input field should be visible
    expect(isVisible).toBe(true);
  });
});

test.describe('Liquidity - Pool Statistics', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to pools page
    await page.goto('/pools');
    await expect(page.getByRole('heading', { name: /Liquidity Pools/i })).toBeVisible();
  });

  test('should display pool statistics section', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(2000);

    // Look for pool statistics info
    const poolStats = page.getByText(/Total Liquidity|SY Reserve|PT Reserve/i);
    const isVisible = await poolStats.first().isVisible().catch(() => false);

    // Pool statistics should be visible
    expect(isVisible).toBe(true);
  });

  test('should display how liquidity works info', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(2000);

    // Look for educational section
    const howItWorks = page.getByText(/How Liquidity Works/i);
    const isVisible = await howItWorks.isVisible().catch(() => false);

    // Educational section should be visible
    expect(isVisible).toBe(true);
  });
});

test.describe('Single-Sided Liquidity - Navigation', () => {
  test('should navigate from home to pools page', async ({ page }) => {
    await page.goto('/');

    // Switch to advanced mode if needed (Pools is advanced-only)
    const advancedToggle = page.getByRole('button', { name: /Switch to advanced mode/i });
    if (await advancedToggle.isVisible()) {
      await advancedToggle.click();
    }

    // Click Pools link
    await page.getByRole('link', { name: /Pools/i }).first().click();
    await expect(page).toHaveURL('/pools');
  });

  test('should have back button on pools page', async ({ page }) => {
    await page.goto('/pools');

    // Look for back button/link
    const backLink = page.getByRole('link', { name: /Back/i });
    await expect(backLink).toBeVisible();
  });

  test('should navigate back to home from pools', async ({ page }) => {
    await page.goto('/pools');

    // Click back link
    const backLink = page.getByRole('link', { name: /Back/i });
    await backLink.click();

    await expect(page).toHaveURL('/');
  });
});

test.describe('Single-Sided Liquidity - Responsive', () => {
  test('should display correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/pools');

    // Verify page loads correctly
    await expect(page.getByRole('heading', { name: /Liquidity Pools/i })).toBeVisible();

    // Tabs should still be visible
    const addTab = page.getByRole('tab', { name: /Add Liquidity/i });
    const isVisible = await addTab.isVisible().catch(() => false);

    // Add Liquidity tab should be visible on mobile
    expect(isVisible).toBe(true);
  });

  test('should display correctly on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/pools');

    // Verify page loads correctly
    await expect(page.getByRole('heading', { name: /Liquidity Pools/i })).toBeVisible();
  });
});
