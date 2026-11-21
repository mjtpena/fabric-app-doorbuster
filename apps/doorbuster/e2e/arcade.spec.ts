/**
 * The centrepiece: renders, lenses, Today focusing a window, view as, the list of the same data, the clock replay and
 * the fallbacks.
 */
import { expect, test } from '@playwright/test';

import { assertNoHorizontalScroll, openApp, watchConsole } from '@x10/shared/e2e';

import { ALEX, isPhone, JORDAN, openToday, PRIYA, windowFor } from './helpers';

test('the arcade draws every deal as a window in its category block', async ({ page }) => {
  const c = watchConsole(page);
  await openApp(page, '/', ALEX);
  await expect(page.getByTestId('arcade')).toBeVisible();
  await expect(page.getByTestId('window')).toHaveCount(18);
  await expect(page.getByTestId('block')).toHaveCount(6);
  const states = await page.getByTestId('window').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
  const count = (s: string) => states.filter((x) => x === s).length;
  expect(count('soldout')).toBe(2);
  expect(count('pending')).toBe(2);
  expect(count('draft')).toBe(1);
  expect(count('scheduled')).toBe(1);
  expect(count('ended')).toBe(1);
  expect(count('cancelled')).toBe(1);
  expect(count('live')).toBe(10);
  await expect(page.locator('[data-testid="amber-shutter"]')).toHaveCount(2);
  await expect(windowFor(page, 'TY-RC-CMT').getByTestId('floor-stencil')).toContainText('4.3%');
  // The queue outside a busy window is longer than outside a quiet one.
  const busy = Number(await windowFor(page, 'EL-EB-PUL').getByTestId('queue').getAttribute('data-count'));
  const quiet = Number(await windowFor(page, 'GR-CF-SOC').getByTestId('queue').getAttribute('data-count'));
  expect(busy).toBeGreaterThan(quiet);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('a lens re-lights the windows and the legend; number keys switch lenses', async ({ page }) => {
  await openApp(page, '/', ALEX);
  const lens = page.getByRole('radiogroup', { name: 'Lens' });
  await expect(lens.getByRole('radio', { name: /Sell-through/ })).toHaveAttribute('aria-checked', 'true');
  const draft = windowFor(page, 'TY-RC-CMT');
  await lens.getByRole('radio', { name: /Margin/ }).click();
  await expect(page.getByTestId('arcade')).toHaveAttribute('data-lens', 'margin');
  await expect(draft).toHaveAttribute('data-lens-color', 'var(--db-neon-bad)');
  await page.keyboard.press('4');
  await expect(lens.getByRole('radio', { name: /Sell-out risk/ })).toHaveAttribute('aria-checked', 'true');
  await expect(windowFor(page, 'EL-EB-PUL')).toHaveAttribute('data-lens-color', 'var(--db-neon-warn)');
  await expect(windowFor(page, 'HM-RV-LFT')).toHaveAttribute('data-lens-color', 'var(--db-neon-ok)');
  await page.keyboard.press('5');
  await expect(windowFor(page, 'HM-RV-LFT')).toHaveAttribute('data-lens-color', 'var(--db-cat-home)');
});

test('a Today item focuses its window and switches to its lens', async ({ page }, info) => {
  await openApp(page, '/', ALEX);
  await openToday(page, isPhone(info.project.name));
  await page.getByRole('button', { name: /Comet RC racer is below the 8% margin floor/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Comet RC racer' })).toBeVisible();
  await expect(windowFor(page, 'TY-RC-CMT')).toHaveAttribute('aria-pressed', 'true');
  await expect(windowFor(page, 'TY-RC-CMT').getByTestId('spotlight')).toHaveCount(1);
  await expect(page.getByRole('radiogroup', { name: 'Lens' }).getByRole('radio', { name: /Margin/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('focus-open').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Comet RC racer' })).toBeVisible();
  await expect(page).toHaveURL(/#\/ticker\//);
});

test('view as approver steps back everything not at the rope; an approver sees approvals first', async ({ page }, info) => {
  const phone = isPhone(info.project.name);
  await openApp(page, '/', ALEX);
  await page.getByRole('radiogroup', { name: 'View as' }).getByRole('radio', { name: 'Approver' }).click();
  await expect(windowFor(page, 'HM-CI-EMB')).toHaveAttribute('opacity', '1');
  await expect(windowFor(page, 'HM-RV-LFT')).toHaveAttribute('opacity', '0.24');
  await page.keyboard.press('v');
  await expect(page.getByRole('radiogroup', { name: 'View as' }).getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
  await expect(windowFor(page, 'HM-RV-LFT')).toHaveAttribute('opacity', '1');

  await openApp(page, '/', JORDAN);
  await expect(page.getByRole('radiogroup', { name: 'View as' }).getByRole('radio', { name: 'Approver' })).toHaveAttribute('aria-checked', 'true');
  await openToday(page, phone);
  await expect(page.getByRole('button', { name: /Ember cast-iron casserole waits at the velvet rope/ })).toBeVisible();
  if (phone) await page.keyboard.press('Escape');

  await openApp(page, '/', PRIYA);
  await expect(page.getByRole('radiogroup', { name: 'View as' }).getByRole('radio', { name: 'Merchandiser' })).toHaveAttribute('aria-checked', 'true');
  await expect(windowFor(page, 'EL-TV55-AUR')).toHaveAttribute('opacity', '0.24');
  await expect(windowFor(page, 'EL-EB-PUL')).toHaveAttribute('opacity', '1');
});

test('the list view shows the same deals, sortable', async ({ page }) => {
  await openApp(page, '/', ALEX);
  await page.getByRole('radio', { name: 'List' }).click();
  await expect(page.getByTestId('deal-row')).toHaveCount(18);
  await expect(page.locator('[data-testid="deal-row"][data-sku="EL-EB-PUL"]')).toContainText(/Sells out ~/);
  await expect(page.locator('[data-testid="deal-row"][data-sku="HM-CI-EMB"]')).toContainText('Awaiting approval');
  // Margin sorts richest first, then (second click) thinnest first: the loss leader.
  await page.getByRole('button', { name: 'Margin' }).click();
  await expect(page.getByTestId('deal-row').first()).toHaveAttribute('data-sku', 'TY-PZ-PKT');
  await page.getByRole('button', { name: 'Margin' }).click();
  await expect(page.getByTestId('deal-row').first()).toHaveAttribute('data-sku', 'GR-OO-ORG');
  await assertNoHorizontalScroll(page);
  await page.getByRole('radio', { name: 'Arcade' }).click();
  await expect(page.getByTestId('arcade')).toBeVisible();
});

test('the clock replays the day from the sales and goes back to live', async ({ page }) => {
  await openApp(page, '/', ALEX);
  const clock = page.getByTestId('arcade-clock');
  await expect(clock).toHaveAttribute('data-live', 'true');
  await expect(windowFor(page, 'EL-TV55-AUR')).toHaveAttribute('data-state', 'soldout');
  await page.getByTestId('clock-slider').focus();
  await page.keyboard.press('Home');
  await expect(clock).toHaveAttribute('data-live', 'false');
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  // Two hours into the event the TV is still selling, not sold out.
  await expect(windowFor(page, 'EL-TV55-AUR')).toHaveAttribute('data-state', 'live');
  await expect(page.getByTestId('arcade-meta')).toContainText('replay');
  await page.keyboard.press('End');
  await expect(clock).toHaveAttribute('data-live', 'true');
  await expect(windowFor(page, 'EL-TV55-AUR')).toHaveAttribute('data-state', 'soldout');
  // R starts the replay; Escape stops it and returns to live.
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('r');
  await expect(page.getByTestId('replay')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(clock).toHaveAttribute('data-live', 'true');
});

test('without WebGL and with reduced motion the arcade still draws, with no snow and no flicker', async ({ page }) => {
  const c = watchConsole(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?nowebgl&as=${ALEX}#/`);
  await expect(page.getByTestId('demo-banner')).toBeVisible();
  await expect(page.getByTestId('window')).toHaveCount(18);
  await expect(page.getByTestId('snow')).toHaveCount(0);
  const anim = await windowFor(page, 'EL-TV55-AUR').getByTestId('sold-out-sign').evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).or(page.getByRole('radio', { name: 'List' })).first().isVisible();
  c.assertClean();
});

test('? opens the shortcut sheet on desktop', async ({ page }, info) => {
  test.skip(isPhone(info.project.name), 'Keyboard shortcuts are a desktop affordance.');
  await openApp(page, '/', ALEX);
  await page.keyboard.press('Shift+?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
});
