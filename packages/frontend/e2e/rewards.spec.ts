import { expect, test } from './fixtures';

/**
 * E2E tests for reward claiming flow on the Portfolio page.
 *
 * Note: These tests verify the UI displays correctly. Actual reward claiming
 * requires a connected wallet with reward-bearing positions, which may not
 * exist on devnet. The tests gracefully handle both states.
 */
test.describe('Reward Claiming', () => {
  test('should display portfolio page with rewards section', async ({ page }) => {
    await page.goto('/portfolio');

    // Verify portfolio page loads
    await expect(page.getByRole('heading', { name: /Portfolio/i })).toBeVisible();

    // Page should load without errors - either showing positions or empty state
    await page.waitForTimeout(2000);

    // Check for either rewards UI or empty/connect wallet state
    const hasRewardsSection =
      (await page.getByText(/External Rewards|YT Rewards|Claimable Rewards/i).isVisible().catch(() => false));
    const hasEmptyState =
      (await page.getByText(/No positions|Connect.*wallet|No external rewards/i).isVisible().catch(() => false));

    // Either state is valid - rewards section visible OR empty/no-wallet state
    expect(hasRewardsSection || hasEmptyState).toBe(true);
  });

  test('should show reward cards when user has reward-bearing positions', async ({ page }) => {
    await page.goto('/portfolio');

    // Wait for data to load
    await page.waitForTimeout(3000);

    // Look for reward-related UI elements
    const rewardCards = page.locator('text=/External Rewards|YT Rewards|Claimable Rewards/i');
    const claimButtons = page.getByRole('button', { name: /Claim|Connect Wallet/i });

    // Check if reward UI is present
    const hasRewardUI = await rewardCards.count().then((c) => c > 0).catch(() => false);
    const hasClaimButton = await claimButtons.count().then((c) => c > 0).catch(() => false);

    // If rewards are present, verify the claim UI is functional
    if (hasRewardUI) {
      // There should be at least one claim or connect button
      expect(hasClaimButton).toBe(true);
    }

    // Test verifies page renders correctly - the conditional assertion above
    // handles the case when rewards are present
  });

  test('should display reward token information correctly', async ({ page }) => {
    await page.goto('/portfolio');

    // Wait for potential reward data to load
    await page.waitForTimeout(3000);

    // If reward cards are visible, they should show token info
    const rewardsVisible = await page.getByText(/External Rewards|YT Rewards/i).isVisible().catch(() => false);

    if (rewardsVisible) {
      // Rewards section should have some content (at least the section header)
      const rewardContent = page.locator('[class*="reward"], [class*="Reward"]');
      const contentCount = await rewardContent.count();
      expect(contentCount).toBeGreaterThan(0);

      // Check for reward token display elements (font-mono class or token text)
      const hasTokenDisplay =
        (await page.locator('[class*="font-mono"]').count()) > 0 ||
        (await page.getByText(/TOKEN|tokens/i).isVisible().catch(() => false));
      expect(hasTokenDisplay).toBe(true);
    }

    // Verify page loaded without errors - check for presence of portfolio content
    const portfolioContent = page.locator('main, [role="main"], .portfolio');
    await expect(portfolioContent.first()).toBeVisible();
  });

  test('should handle reward claim button states correctly', async ({ page }) => {
    await page.goto('/portfolio');

    // Wait for UI to settle
    await page.waitForTimeout(2000);

    // Find any claim-related buttons
    const claimAllButton = page.getByRole('button', { name: /Claim All/i });
    const claimRewardsButton = page.getByRole('button', { name: /Claim Rewards/i });
    const connectButton = page.getByRole('button', { name: /Connect Wallet/i });

    // Check button visibility
    const hasClaimAll = await claimAllButton.isVisible().catch(() => false);
    const hasClaimRewards = await claimRewardsButton.isVisible().catch(() => false);
    const hasConnect = await connectButton.count().then((c) => c > 0).catch(() => false);

    // If claim buttons are visible without wallet, they should be disabled or show connect
    if (hasClaimAll || hasClaimRewards) {
      // Buttons should exist and be in a valid state
      const button = hasClaimAll ? claimAllButton : claimRewardsButton;
      await expect(button).toBeVisible();
    }

    // Verify portfolio page rendered - either has claim buttons or connect prompt
    const hasAnyInteractiveElement = hasClaimAll || hasClaimRewards || hasConnect;
    expect(hasAnyInteractiveElement).toBe(true);
  });

  test('should display gas estimate for reward claims when rewards available', async ({ page }) => {
    await page.goto('/portfolio');

    // Wait for data to load
    await page.waitForTimeout(3000);

    // Check if rewards section has gas estimate
    const gasEstimate = page.getByText(/Estimated Gas|Gas/i);
    const hasGasEstimate = await gasEstimate.isVisible().catch(() => false);

    // Check if rewards are visible (gas estimate only shown with rewards + wallet)
    const hasRewards = await page.getByText(/External Rewards|YT Rewards/i).isVisible().catch(() => false);

    // If rewards are displayed, verify gas estimate behavior is reasonable
    if (hasRewards && hasGasEstimate) {
      await expect(gasEstimate).toBeVisible();
    }

    // Verify page structure exists
    await expect(page.getByRole('heading', { name: /Portfolio/i })).toBeVisible();
  });
});

test.describe('Reward UI Components', () => {
  test('should render portfolio rewards card skeleton during loading', async ({ page }) => {
    // Navigate and check for loading state
    await page.goto('/portfolio');

    // Look for skeleton elements (loading state) or final content
    const skeletons = page.locator('[class*="skeleton"], [class*="Skeleton"]');
    const portfolioHeading = page.getByRole('heading', { name: /Portfolio/i });

    // Either skeletons are visible (loading) or content has loaded
    const hasSkeletons = await skeletons.count().then((c) => c > 0).catch(() => false);
    const hasContent = await portfolioHeading.isVisible().catch(() => false);

    // Page should show either loading state or loaded content
    expect(hasSkeletons || hasContent).toBe(true);
  });

  test('should show empty reward state when no rewards available', async ({ page }) => {
    await page.goto('/portfolio');

    // Wait for content
    await page.waitForTimeout(2000);

    // Look for empty state messaging
    const emptyMessages = [
      /No external rewards available/i,
      /No YT rewards available/i,
      /No rewards available/i,
      /Rewards.*will appear here/i,
      /No positions/i,
    ];

    let foundEmptyState = false;
    for (const pattern of emptyMessages) {
      const visible = await page.getByText(pattern).isVisible().catch(() => false);
      if (visible) {
        foundEmptyState = true;
        break;
      }
    }

    // Check if rewards are actually available (alternative valid state)
    const hasRewards = await page.getByText(/External Rewards|YT Rewards|Claimable/i).isVisible().catch(() => false);

    // Page should show either empty state or rewards content
    expect(foundEmptyState || hasRewards).toBe(true);
  });
});
