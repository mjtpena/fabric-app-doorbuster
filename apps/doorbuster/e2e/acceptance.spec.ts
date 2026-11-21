/**
 * The five acceptance criteria of the Doorbuster spec, through the UI.
 */
import { expect, test } from '@playwright/test';

import { assertNoHorizontalScroll, openApp, watchConsole } from '@x10/shared/e2e';

import { ALEX, JORDAN, SAM, switchTo, windowFor } from './helpers';

test('AC1: saving a deal below the margin floor is blocked with the computed margin shown', async ({ page }) => {
  const c = watchConsole(page);
  await openApp(page, '/shopfront', SAM);
  await page.getByLabel('Deal name').fill('Comet RC racer, blue');
  await page.getByLabel('SKU').fill('TY-RC-CMT-B');
  await page.getByLabel('Category').selectOption('toys');
  await page.getByLabel('List price').fill('79');
  await page.getByLabel('Unit cost').fill('44');
  await page.getByLabel('Deal price').fill('46');
  await page.getByLabel('Stock').fill('120');
  await page.getByLabel('Target').fill('100');
  // The guard is live before saving: margin 4.3%, the preview window papered over.
  await expect(page.getByTestId('margin-guard')).toHaveAttribute('data-blocked', 'true');
  await expect(page.getByTestId('margin-guard')).toContainText('Margin 4.3% is below the 8% floor');
  await expect(page.getByTestId('guard-margin')).toHaveText('4.3%');
  await expect(page.getByTestId('window-preview')).toHaveAttribute('data-blocked', 'true');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByTestId('form-blocked')).toHaveText('Blocked: margin 4.3% is below the 8% floor.');
  await page.getByRole('button', { name: 'Send to the velvet rope' }).click();
  await expect(page.getByTestId('form-blocked')).toBeVisible();
  await expect(page).toHaveURL(/#\/shopfront$/);
  // A loss leader with a real reason may go below the floor (and always needs approval).
  await page.getByLabel('Loss leader').check();
  await page.getByLabel('Why it is worth the loss').fill('Brings families to the toy aisle on the busiest night.');
  await expect(page.getByTestId('margin-guard')).toHaveAttribute('data-blocked', 'false');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('AC2: a deep discount goes to pending, and its owner cannot approve it', async ({ page }) => {
  const c = watchConsole(page);
  await openApp(page, '/shopfront', ALEX);
  await page.getByLabel('Deal name').fill('Aurora soundbar');
  await page.getByLabel('SKU').fill('EL-SB-AUR');
  await page.getByLabel('List price').fill('300');
  await page.getByLabel('Unit cost').fill('110');
  await page.getByLabel('Deal price').fill('150');
  await page.getByLabel('Stock').fill('60');
  await page.getByLabel('Target').fill('50');
  await page.getByRole('button', { name: 'Send to the velvet rope' }).click();
  await expect(windowFor(page, 'EL-SB-AUR')).toHaveAttribute('data-state', 'pending');
  await expect(windowFor(page, 'EL-SB-AUR').getByTestId('velvet-rope')).toHaveCount(1);

  // Alex is an approver, but owns it: the rope does not open for him.
  await page.goto('/#/rope');
  await page.getByRole('link', { name: /Aurora soundbar/ }).click();
  await expect(page.getByTestId('own-deal')).toContainText('You own this deal');
  await expect(page.getByTestId('approve')).toHaveCount(0);

  // Jordan, another approver, opens it.
  await switchTo(page, JORDAN, '/rope');
  await page.getByRole('link', { name: /Aurora soundbar/ }).click();
  await page.getByTestId('approve').click();
  await expect(page.getByText('Aurora soundbar is approved.')).toBeVisible();
  await page.goto('/#/');
  await expect(windowFor(page, 'EL-SB-AUR')).toHaveAttribute('data-state', 'scheduled');
  c.assertClean();
});

test('AC3: a seeded sold-out deal is a dark window with SOLD OUT, and the list agrees', async ({ page }) => {
  await openApp(page, '/', ALEX);
  const tv = windowFor(page, 'EL-TV55-AUR');
  await expect(tv).toHaveAttribute('data-state', 'soldout');
  await expect(tv.getByTestId('sold-out-sign')).toContainText('SOLD');
  await expect(tv.getByTestId('sold-out-sign')).toContainText('OUT');
  await expect(tv.getByTestId('price-tag')).toHaveCount(0);
  await expect(tv.getByTestId('queue')).toHaveAttribute('data-count', '0');
  await expect(page.locator('[data-testid="window"][data-state="soldout"]')).toHaveCount(2);
  await page.getByRole('radio', { name: 'List' }).click();
  const row = page.locator('[data-testid="deal-row"][data-sku="EL-TV55-AUR"]');
  await expect(row).toContainText('Sold out');
  await expect(row).toContainText('120 / 120');
});

test('AC4: the sell-out forecast shows the projected time and warns when it is before the end', async ({ page }) => {
  await openApp(page, '/ticker', ALEX);
  await page.getByRole('link', { name: 'Pulse wireless earbuds' }).first().click();
  const f = page.getByTestId('forecast');
  await expect(f).toHaveAttribute('data-kind', 'early');
  await expect(f).toContainText(/Sells out around \d{1,2}:\d{2}.*before the deal ends at/);
  await expect(page.getByTestId('projection')).toBeVisible();
  // A deal that lasts says so, with no warning.
  await page.goto('/#/ticker');
  await page.getByRole('link', { name: 'Loft robot vacuum' }).first().click();
  await expect(page.getByTestId('forecast')).toHaveAttribute('data-kind', 'lasts');
  await expect(page.getByTestId('forecast')).toContainText('Lasts to the end');
  // The arcade shows the same warning as an amber shutter with the time on it.
  await page.goto('/#/');
  await expect(windowFor(page, 'EL-EB-PUL').getByTestId('amber-shutter')).toContainText(/OUT ~\d{1,2}:\d{2}/);
  await expect(windowFor(page, 'HM-RV-LFT').getByTestId('amber-shutter')).toHaveCount(0);
});

test('AC5: importing a CSV with an unknown SKU shows a row error and imports the rest', async ({ page }) => {
  const c = watchConsole(page);
  await openApp(page, '/receipts', SAM);
  const at = await page.evaluate(() => {
    const d = new Date(Date.now() - 7 * 60_000);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  await page.getByLabel('Till export (CSV)').fill(['sku,at,units,revenue', `HM-RV-LFT,${at},4,996.00`, `ZZ-NOT-A-DEAL,${at},2,40.00`, `GR-CF-SOC,${at},3,"$87.00"`].join('\n'));
  await expect(page.getByTestId('receipts-summary')).toHaveText('2 ready · 1 with errors');
  await expect(page.locator('[data-ok="false"]:visible')).toContainText('Unknown SKU ZZ-NOT-A-DEAL: no deal sells it.');
  await assertNoHorizontalScroll(page);
  await page.getByTestId('import').click();
  await expect(page.getByText('2 sales imported, 1 skipped.')).toBeVisible();
  await page.goto('/#/ticker');
  await expect(page.getByTestId('sales-feed').getByText('Loft robot vacuum').first()).toBeVisible();
  await expect(page.getByTestId('sales-feed')).toContainText('import');
  c.assertClean();
});
