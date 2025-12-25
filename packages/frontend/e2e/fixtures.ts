import { test as base, expect as baseExpect } from '@playwright/test';

/**
 * Extended Playwright test with webkit-specific handling
 *
 * WebKit in headless mode requires explicit waits for page hydration.
 * This fixture automatically waits for 'networkidle' after navigation
 * specifically for webkit browsers.
 *
 * @see https://github.com/microsoft/playwright/issues/21785
 */
export const test = base.extend({
  page: async ({ page, browserName }, use) => {
    // Wrap goto to add networkidle wait and extra delay for webkit
    const originalGoto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await originalGoto(url, options);
      if (browserName === 'webkit') {
        // Wait for network to be idle
        await page.waitForLoadState('networkidle');
        // Additional wait for React hydration in webkit
        await page.waitForTimeout(500);
      }
      return response;
    };

    await use(page);
  },
});

// Re-export expect with longer default timeout for webkit
export const expect = baseExpect;
