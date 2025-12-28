import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Visual regression test settings */
  expect: {
    toHaveScreenshot: {
      /* Allow 0.2% pixel difference for anti-aliasing */
      maxDiffPixelRatio: 0.002,
      /* Threshold for individual pixel color difference */
      threshold: 0.2,
      /* Animation timing - wait for animations to complete */
      animations: 'disabled',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // WebKit disabled due to flaky headless mode behavior
    // https://github.com/microsoft/playwright/issues/21785
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    /* Visual regression tests - run only on chromium for consistency */
    {
      name: 'visual',
      testMatch: /visual\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        /* Consistent viewport for visual tests */
        viewport: { width: 1280, height: 720 },
        /* Disable animations for consistent screenshots */
        launchOptions: {
          args: ['--force-prefers-reduced-motion'],
        },
      },
    },
  ],

  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env['CI'],
    timeout: 120 * 1000,
  },
});
