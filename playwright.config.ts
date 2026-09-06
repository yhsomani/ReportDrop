import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for ReportDrop.
 *
 * Runs against the local Vite dev server with the internal engine enabled
 * (simulates the complete user-facing product flow in-browser: registration,
 * workspace creation, CSV parsing, report generation, private/public toggle,
 * and public share view).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  }
});
