/**
 * Redesign screenshots (not a test). Run: SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts
 * Writes docs/redesign/<screen>-<theme>-<desktop|phone>.png. SHOTS=name1,name2 limits the set; THEMES=dark limits themes.
 */
import { test, type Page } from '@playwright/test';

import { openApp } from '@x10/shared/e2e';

import { ALEX, JORDAN, SAM } from './helpers';

type Shot = { name: string; path: string; persona: string; full?: boolean; act?: (page: Page, phone: boolean) => Promise<void> };

const lens = (name: RegExp) => async (page: Page) => {
  await page.getByRole('radiogroup', { name: 'Lens' }).getByRole('radio', { name }).click();
};

const SHOTS: Shot[] = [
  { name: 'arcade', path: '/', persona: ALEX },
  { name: 'arcade-risk', path: '/', persona: ALEX, act: lens(/Sell-out risk/) },
  { name: 'arcade-margin', path: '/', persona: ALEX, act: lens(/Margin/) },
  { name: 'arcade-category', path: '/', persona: ALEX, act: lens(/Category/) },
  {
    name: 'arcade-approver',
    path: '/',
    persona: JORDAN,
    act: lens(/Discount/),
  },
  {
    name: 'arcade-today-focus',
    path: '/',
    persona: ALEX,
    act: async (page, phone) => {
      if (phone) await page.getByRole('button', { name: /^Today/ }).click();
      await page.getByRole('button', { name: /Pulse wireless earbuds sells out around/ }).click();
    },
  },
  {
    name: 'arcade-replay',
    path: '/',
    persona: ALEX,
    act: async (page) => {
      await page.getByTestId('clock-slider').focus();
      await page.keyboard.press('PageDown');
      await page.keyboard.press('PageDown');
      await page.keyboard.press('PageDown');
      await page.keyboard.press('PageDown');
      await page.keyboard.press('PageDown');
    },
  },
  {
    name: 'arcade-list',
    path: '/',
    persona: ALEX,
    full: true,
    act: async (page) => {
      await page.getByRole('radio', { name: 'List' }).click();
    },
  },
  { name: 'shopfront', path: '/shopfront', persona: SAM, full: true },
  {
    name: 'shopfront-blocked',
    path: '/shopfront',
    persona: SAM,
    full: true,
    act: async (page) => {
      await page.getByLabel('Deal name').fill('Comet RC racer, red');
      await page.getByLabel('SKU').fill('TY-RC-CMT-R');
      await page.getByLabel('Category').selectOption('toys');
      await page.getByLabel('List price').fill('79');
      await page.getByLabel('Unit cost').fill('44');
      await page.getByLabel('Deal price').fill('46');
      await page.getByLabel('Stock').fill('120');
      await page.getByLabel('Target').fill('100');
    },
  },
  { name: 'velvet-rope', path: '/rope', persona: ALEX, full: true },
  { name: 'ticker', path: '/ticker', persona: ALEX, full: true },
  {
    name: 'ticker-deal',
    path: '/ticker',
    persona: ALEX,
    full: true,
    act: async (page) => {
      await page.getByRole('link', { name: 'Pulse wireless earbuds' }).first().click();
    },
  },
  { name: 'calendar', path: '/calendar', persona: ALEX, full: true },
  { name: 'receipts', path: '/receipts', persona: SAM, full: true },
  {
    name: 'receipts-preview',
    path: '/receipts',
    persona: SAM,
    full: true,
    act: async (page) => {
      await page.getByRole('button', { name: 'Use the template' }).click();
    },
  },
  { name: 'staff', path: '/staff', persona: ALEX, full: true },
  { name: 'about', path: '/about', persona: ALEX, full: true },
];

const only = process.env.SHOTS?.split(',').filter(Boolean);
const themes = (process.env.THEMES?.split(',').filter(Boolean) as ('light' | 'dark')[] | undefined) ?? ['light', 'dark'];

for (const scheme of themes) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });
    for (const s of SHOTS) {
      test(`${s.name} ${scheme}`, async ({ page }, info) => {
        test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to write the redesign screenshots.');
        test.skip(!!only && !only.includes(s.name), 'not selected');
        const phone = info.project.name === 'phone';
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await openApp(page, s.path, s.persona);
        await page.getByTestId('demo-banner').getByRole('button').first().click().catch(() => undefined);
        if (s.act) await s.act(page, phone);
        await page.waitForTimeout(900);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `docs/redesign/${s.name}-${scheme}-${phone ? 'phone' : 'desktop'}.png`, fullPage: !!s.full && !phone });
      });
    }
  });
}
