/**
 * App configuration. No React imports here: tools/seed-fabric.mjs loads this file in Node to export seed rows.
 */
import type { Persona } from '@x10/shared/identity';
import type { AppConfig } from '@x10/shared/runtime';

import { defs, type Schema } from './model';
import { seed } from './seed';

/**
 * Demo personas. Order matters to the seed: 0 admin (merchandiser and approver), 1 and 2 merchandisers, 3 approver,
 * 4 viewer. Alex owns one of the two deep discounts at the velvet rope, so Alex can approve Sam's but not his own.
 */
export const personas: Persona[] = [
  { sub: 'demo-admin-alex', name: 'Alex Rivera', email: 'alex@example.com', isAdmin: true, role: 'Admin, approver' },
  { sub: 'demo-merch-sam', name: 'Sam Taylor', email: 'sam@example.com', isAdmin: false, role: 'Merchandiser' },
  { sub: 'demo-merch-priya', name: 'Priya Nair', email: 'priya@example.com', isAdmin: false, role: 'Merchandiser' },
  { sub: 'demo-approver-jordan', name: 'Jordan Lee', email: 'jordan@example.com', isAdmin: false, role: 'Approver' },
  { sub: 'demo-viewer-chen', name: 'Chen Wei', email: 'chen@example.com', isAdmin: false, role: 'Viewer' },
];

export const PERSONA = {
  alex: personas[0].sub,
  sam: personas[1].sub,
  priya: personas[2].sub,
  jordan: personas[3].sub,
  chen: personas[4].sub,
} as const;

export const config: AppConfig<Schema> = {
  appId: 'doorbuster',
  title: 'Doorbuster',
  tagline: 'A Cyber Monday deal desk: a margin guard, a second key on deep discounts, and live sell-out forecasts.',
  defs,
  personas,
  seed,
  accent: 'volt',
  // A shop window under an awning with a price tag hanging in it (JSX-free for the seed tools).
  logoPaths: ['M4 9h16', 'M5 9l1.5-4h11L19 9', 'M5 9v11h14V9', 'M9 20v-6h6v6', 'M8 12.5h2', 'M14 12.5h2'],
  // Phone tab-bar icons are attached in main.tsx (navIcons) to keep this file JSX-free.
  nav: [
    { to: '/', label: 'Arcade', end: true },
    { to: '/shopfront', label: 'Shopfront' },
    { to: '/rope', label: 'Velvet rope' },
    { to: '/ticker', label: 'Ticker' },
    { to: '/calendar', label: 'Promo calendar' },
    { to: '/receipts', label: 'Receipts' },
    { to: '/staff', label: 'Floor staff', adminOnly: true },
    { to: '/about', label: 'About' },
  ],
};
