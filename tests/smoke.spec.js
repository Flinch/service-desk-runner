import { test, expect } from '@playwright/test';

// These @smoke tests are what the demo triggers.
// Keep them fast (< 30s total) and reliable.

test('@smoke homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/desk/i);
});

test('@smoke can view ticket list', async ({ page }) => {
  await page.goto('/');
  // Adjust selector to match your actual app
  const ticketList = page.getByTestId('ticket-list');
  await expect(ticketList).toBeVisible();
});

test('@smoke can open new ticket form', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /new ticket/i }).click();
  const form = page.getByTestId('ticket-form');
  await expect(form).toBeVisible();
});

test('@smoke can submit a ticket', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /new ticket/i }).click();
  await page.getByTestId('ticket-title-input').fill('Demo ticket from live test run');
  await page.getByTestId('ticket-submit').click();
  // Confirm ticket appears in list
  await expect(page.getByText('Demo ticket from live test run')).toBeVisible();
});
