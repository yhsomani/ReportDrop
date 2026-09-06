// End-to-End: full report flow through the real stack
//
// register → create workspace → (dev) load sample data → parse & validate →
// compile & launch report → return to dashboard → enable public share →
// open the public /r/:token link → assert the KPI renders read-only.
//
// This runs against the Vite dev server with the internal engine enabled
// (DEMO_MODE), so every network call hits the real API router and database.
//
// Requires: `npx playwright install chromium` (one-time browser download).

import { test, expect } from '@playwright/test';

test('full report lifecycle: register → compile → share → public read-only view', async ({ page }) => {
  const email = `e2e_${Date.now()}@example.com`;
  const password = 'Password123!';
  const clientName = 'E2E Dental Care';
  const clientDomain = 'e2edental.com';

  // ── Register a fresh account ──────────────────────────────────────────────
  await page.goto('/');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await page.getByPlaceholder('Jane Doe').fill('E2E Tester');
  await page.getByPlaceholder('Apex Marketing Agency').fill('E2E Agency');
  await page.getByPlaceholder('you@agency.com').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Start Free Trial' }).click();

  // Land on the dashboard.
  await expect(page.getByText('SEO Client Report Compiler')).toBeVisible();

  // ── Create a client workspace ─────────────────────────────────────────────
  await page.getByRole('button', { name: '+ New Client Workspace' }).click();
  await page.getByPlaceholder('e.g. Acme Dental Clinic').fill(clientName);
  await page.getByPlaceholder('e.g. acmedental.com').fill(clientDomain);
  await page.getByRole('button', { name: 'Create Workspace' }).click();
  await expect(page.getByText(clientDomain).first()).toBeVisible();

  // ── Compile a report from sample CSV data ─────────────────────────────────
  await page.getByRole('button', { name: 'Compile New Report' }).click();
  await expect(page.getByText('Compile Monthly Client Report')).toBeVisible();

  // The sample loader is dev-only; it is present because we run the dev server.
  await page.getByRole('button', { name: 'Load Sample SEO CSV Data' }).click();

  await page.getByRole('button', { name: 'Parse & Validate Metrics' }).click();
  await expect(page.getByText('All Formula Injections Neutralized')).toBeVisible();

  await page.getByRole('button', { name: 'Compile & Launch Report' }).click();

  // The report view renders the compiled KPIs.
  await expect(page.getByText('Total Clicks').first()).toBeVisible();

  // ── Return to the dashboard and enable public sharing ────────────────────
  await page.getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: clientName })).toBeVisible();

  // Open the share modal for the newly created report.
  await page.getByTitle('Share Link').click();
  await expect(page.getByText('Share Client Report')).toBeVisible();

  // Flip the public toggle on.
  await page.locator('button[class*="h-6 w-11"]').click();
  await expect(page.getByText('Public Link Enabled')).toBeVisible();

  // Read the generated share URL and visit it.
  const shareUrl = await page.locator('input[readonly]').inputValue();
  expect(shareUrl).toMatch(/\/r\/[A-Za-z0-9_-]+$/);

  await page.getByRole('button', { name: 'Done' }).click();
  await page.goto(shareUrl);

  // ── Public view is a read-only, KPI-bearing report ───────────────────────
  await expect(page.getByText('Total Clicks').first()).toBeVisible();
  // No editing affordance on the public boundary.
  await expect(page.getByRole('button', { name: 'Edit Commentary & Brand' })).toHaveCount(0);
  await expect(page.getByText('Share Client Report')).toHaveCount(0);
});
