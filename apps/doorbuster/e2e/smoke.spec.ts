import { expect, test } from '@playwright/test';

import { assertNoHorizontalScroll, openApp, watchConsole } from '@x10/shared/e2e';

import { SAM, windowFor } from './helpers';

test('loads, creates a record, sees it listed, no console errors', async ({ page }) => {
  const consoleWatch = watchConsole(page);
  await openApp(page, '/', SAM);
  await expect(page.getByRole('heading', { name: 'The midnight arcade' })).toBeVisible();
  await expect(page.getByTestId('window')).toHaveCount(18);
  await assertNoHorizontalScroll(page);

  // Create: open a shopfront for a light discount.
  await page.goto('/#/shopfront');
  await page.getByLabel('Deal name').fill('Frost glass tumblers');
  await page.getByLabel('SKU').fill('hm gl 204');
  await page.getByLabel('Category').selectOption('home');
  await page.getByLabel('List price').fill('48');
  await page.getByLabel('Unit cost').fill('18');
  await page.getByLabel('Deal price').fill('36');
  await page.getByLabel('Stock').fill('200');
  await page.getByLabel('Target').fill('150');
  await expect(page.getByTestId('margin-guard')).toContainText('Margin 50.0%, above the 8% floor');
  await assertNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Open the shop' }).click();

  // See it: the arcade focuses its new window, scheduled to open; and the list has the row.
  await expect(page.getByRole('heading', { level: 1, name: 'Frost glass tumblers' })).toBeVisible();
  await expect(windowFor(page, 'HM-GL-204')).toHaveAttribute('data-state', 'scheduled');
  await expect(page.getByTestId('window')).toHaveCount(19);
  await page.getByRole('radio', { name: 'List' }).click();
  await expect(page.locator('[data-testid="deal-row"][data-sku="HM-GL-204"]')).toContainText('Scheduled');
  await assertNoHorizontalScroll(page);
  consoleWatch.assertClean();
});
