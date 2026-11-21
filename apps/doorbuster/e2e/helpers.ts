import { expect, type Page } from '@playwright/test';

export const ALEX = 'demo-admin-alex';
export const SAM = 'demo-merch-sam';
export const PRIYA = 'demo-merch-priya';
export const JORDAN = 'demo-approver-jordan';
export const CHEN = 'demo-viewer-chen';

/** Switch persona keeping the stored demo data (as the recorder does). */
export async function switchTo(page: Page, persona: string, path: string) {
  await page.goto(`/?as=${encodeURIComponent(persona)}#${path}`);
  await expect(page.getByTestId('demo-banner')).toBeVisible();
}

export const isPhone = (projectName: string) => projectName === 'phone';

/** On phones Today lives in a bottom sheet behind a button. */
export async function openToday(page: Page, phone: boolean) {
  if (phone) await page.getByRole('button', { name: /^Today/ }).click();
}

export const windowFor = (page: Page, sku: string) => page.locator(`[data-testid="window"][data-sku="${sku}"]`);
