import type { DataStore } from '@x10/shared/data';
import type { SeedContext } from '@x10/shared/runtime';

import type { Category, Deal, Schema } from './model';
import { termsKey } from './domain/pricing';

const MIN = 60_000;
const HOUR = 60 * MIN;
const TICK_MS = 15 * MIN;

/**
 * The event: a 24-hour Cyber Monday that opened ten hours before `now` (on a 15-minute grid, so the numbers below
 * hold whatever minute the seed runs). Persona order: 0 Alex (admin), 1 Sam and 2 Priya (merchandisers),
 * 3 Jordan (approver), 4 Chen (viewer).
 */
export function eventStart(now: Date): number {
  return Math.floor(now.getTime() / TICK_MS) * TICK_MS - 10 * HOUR;
}

interface Spec {
  name: string;
  sku: string;
  category: Category;
  list: number;
  cost: number;
  price: number;
  stock: number;
  target: number;
  /** Hours after the event start. */
  start: number;
  end: number;
  status: Deal['status'];
  owner: number;
  /** Planned selling pace, units an hour (0 = no sales). */
  rate: number;
  /** An approval on the current terms by this persona. */
  approvedBy?: number;
  lossReason?: string;
  /** Hours before the event start the terms were submitted (default 30). */
  submitted?: number;
}

/**
 * 18 deals, three per category. By construction: two sold out (the TV, the beanie), two sell out early (the earbuds
 * within two hours, the bedding later), one below the margin floor as a blocked draft (the RC racer), two deep
 * discounts at the velvet rope (the casserole, Sam's; the overcoat, Alex's own), one loss leader approved, one
 * scheduled, one ended on time, one cancelled.
 */
export const SPECS: Spec[] = [
  { name: 'Aurora 55" 4K TV', sku: 'EL-TV55-AUR', category: 'electronics', list: 899, cost: 520, price: 599, stock: 120, target: 110, start: 0, end: 24, status: 'approved', owner: 1, rate: 22 },
  { name: 'Pulse wireless earbuds', sku: 'EL-EB-PUL', category: 'electronics', list: 149, cost: 38, price: 79, stock: 380, target: 300, start: 2, end: 24, status: 'pending', owner: 2, rate: 40, approvedBy: 3 },
  { name: 'Vector 16" gaming laptop', sku: 'EL-LT16-VEC', category: 'electronics', list: 1899, cost: 1350, price: 1499, stock: 80, target: 70, start: 1, end: 24, status: 'approved', owner: 1, rate: 3 },
  { name: 'Ember cast-iron casserole', sku: 'HM-CI-EMB', category: 'home', list: 249, cost: 72, price: 129, stock: 150, target: 120, start: 12, end: 24, status: 'pending', owner: 1, rate: 0, submitted: -7 },
  { name: 'Loft robot vacuum', sku: 'HM-RV-LFT', category: 'home', list: 399, cost: 180, price: 249, stock: 500, target: 400, start: 0, end: 24, status: 'approved', owner: 2, rate: 18 },
  { name: 'Driftwood linen bedding set', sku: 'HM-BD-DRF', category: 'home', list: 189, cost: 61, price: 119, stock: 300, target: 250, start: 1, end: 20, status: 'approved', owner: 0, rate: 22 },
  { name: 'Harbour wool overcoat', sku: 'FA-OC-HRB', category: 'fashion', list: 320, cost: 96, price: 179, stock: 90, target: 80, start: 11, end: 24, status: 'pending', owner: 0, rate: 0, submitted: -8 },
  { name: 'Trailhead knit beanie', sku: 'FA-BN-TRL', category: 'fashion', list: 39, cost: 9, price: 19, stock: 600, target: 500, start: 0, end: 18, status: 'pending', owner: 2, rate: 95, approvedBy: 0, submitted: 48 },
  { name: 'Meridian leather sneakers', sku: 'FA-SN-MER', category: 'fashion', list: 140, cost: 52, price: 99, stock: 260, target: 200, start: 3, end: 24, status: 'approved', owner: 1, rate: 11 },
  { name: 'Starforge building set', sku: 'TY-BS-STF', category: 'toys', list: 129, cost: 58, price: 89, stock: 220, target: 180, start: 0, end: 24, status: 'approved', owner: 2, rate: 8 },
  { name: 'Comet RC racer', sku: 'TY-RC-CMT', category: 'toys', list: 79, cost: 44, price: 46, stock: 200, target: 150, start: 13, end: 24, status: 'draft', owner: 1, rate: 0 },
  { name: 'Pocket puzzle cube', sku: 'TY-PZ-PKT', category: 'toys', list: 19, cost: 4, price: 12, stock: 1000, target: 400, start: 0, end: 6, status: 'approved', owner: 2, rate: 50 },
  { name: 'Glow serum trio', sku: 'BT-SR-GLW', category: 'beauty', list: 89, cost: 21, price: 59, stock: 400, target: 260, start: 2, end: 24, status: 'approved', owner: 0, rate: 14 },
  { name: 'Velour hair dryer', sku: 'BT-HD-VEL', category: 'beauty', list: 229, cost: 120, price: 159, stock: 120, target: 100, start: 13, end: 24, status: 'approved', owner: 2, rate: 0 },
  { name: 'Cedar beard kit', sku: 'BT-BK-CDR', category: 'beauty', list: 49, cost: 14, price: 29, stock: 150, target: 100, start: 4, end: 24, status: 'cancelled', owner: 1, rate: 0 },
  { name: 'Single-origin coffee, 1 kg', sku: 'GR-CF-SOC', category: 'grocery', list: 42, cost: 17, price: 29, stock: 300, target: 240, start: 1, end: 24, status: 'approved', owner: 0, rate: 6 },
  { name: 'Holiday hamper deluxe', sku: 'GR-HP-DLX', category: 'grocery', list: 150, cost: 98, price: 109, stock: 140, target: 100, start: 0, end: 24, status: 'approved', owner: 2, rate: 5 },
  {
    name: 'Organic olive oil, 1 L',
    sku: 'GR-OO-ORG',
    category: 'grocery',
    list: 24,
    cost: 11,
    price: 9.99,
    stock: 800,
    target: 600,
    start: 0,
    end: 24,
    status: 'pending',
    owner: 1,
    rate: 28,
    approvedBy: 3,
    lossReason: 'Traffic driver for the grocery aisle: last year the basket attach rate more than covered the loss.',
  },
];

/** Deterministic noise in [0.8, 1.2) from a SKU and a tick number. */
function noise(sku: string, k: number): number {
  let h = 2166136261;
  const s = `${sku}#${k}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return 0.8 + ((h >>> 0) % 4000) / 10000;
}

/** Units per 15-minute tick from the start to `until`, ramping up in the first half hour, stopping at stock. */
export function tickPlan(spec: Spec, start: number, until: number): { at: number; units: number }[] {
  const out: { at: number; units: number }[] = [];
  if (spec.rate <= 0) return out;
  let acc = 0;
  let sold = 0;
  for (let k = 1; ; k++) {
    const at = start + k * TICK_MS;
    if (at > until) break;
    const ramp = k === 1 ? 0.7 : k === 2 ? 0.9 : 1;
    acc += (spec.rate / 4) * ramp * noise(spec.sku, k);
    let units = Math.floor(acc);
    acc -= units;
    if (units <= 0) continue;
    if (sold + units >= spec.stock) units = spec.stock - sold;
    sold += units;
    out.push({ at, units });
    if (sold >= spec.stock) break;
  }
  return out;
}

const NOTES: { sku: string; author: number; hoursAgo: number; body: string }[] = [
  { sku: 'TY-RC-CMT', author: 1, hoursAgo: 3, body: 'Supplier invoice came in at 44.00 a unit, up from 38.00. At 46.00 that is a 4.3% margin, so I need a better price or a loss-leader case.' },
  { sku: 'EL-EB-PUL', author: 2, hoursAgo: 26, body: 'Hero item for the morning email. The warehouse can top up 150 units by noon if we ask before ten.' },
  { sku: 'EL-TV55-AUR', author: 1, hoursAgo: 4, body: 'Sold out before lunch again. Ask the buyer for double the stock next year.' },
  { sku: 'FA-OC-HRB', author: 0, hoursAgo: 8, body: "Clearing last season's colours. The 44% is agreed with the brand and the cost is the clearance price." },
  { sku: 'GR-OO-ORG', author: 3, hoursAgo: 30, body: 'Approved as a loss leader for the grocery aisle. Cap it at the stock we have; no top-ups.' },
];

/** Fictional, generic seed data. Dates are computed from ctx.now. Runs once (runSeed checks a marker row). */
export async function seed(store: DataStore<Schema>, ctx: SeedContext): Promise<void> {
  const p = ctx.people;
  const now = ctx.now.getTime();
  const S = eventStart(ctx.now);
  const iso = (ms: number) => new Date(ms).toISOString();
  const deals = store.repo('Deal');
  const ids = new Map<string, string>();

  for (const s of SPECS) {
    const owner = p[s.owner];
    const submitted = S - (s.submitted ?? 30) * HOUR;
    const created = Math.min(submitted, S - 50 * HOUR);
    const row = await deals.create({
      name: s.name,
      sku: s.sku,
      category: s.category,
      listPrice: s.list,
      unitCost: s.cost,
      dealPrice: s.price,
      stockUnits: s.stock,
      targetUnits: s.target,
      startsAt: iso(S + s.start * HOUR),
      endsAt: iso(S + s.end * HOUR),
      status: s.status,
      lossLeader: !!s.lossReason,
      lossReason: s.lossReason ?? null,
      ownerSub: owner.sub,
      ownerName: owner.displayName,
      submittedAt: s.status === 'draft' ? null : iso(submitted),
      createdAt: iso(created),
      updatedAt: iso(s.sku === 'TY-RC-CMT' ? now - 3 * HOUR : submitted),
    });
    ids.set(s.sku, row.id);

    if (s.approvedBy !== undefined) {
      const by = p[s.approvedBy];
      await store.repo('Approval').create({
        dealId: row.id,
        dealOwnerSub: owner.sub,
        approverSub: by.sub,
        approverName: by.displayName,
        decision: 'approved',
        termsKey: termsKey({ listPrice: s.list, unitCost: s.cost, dealPrice: s.price, lossLeader: !!s.lossReason }),
        note: s.lossReason ? 'Loss leader agreed for this event only.' : null,
        decidedAt: iso(submitted + 2 * HOUR),
      });
    }

    const until = Math.min(now, S + s.end * HOUR);
    for (const t of tickPlan(s, S + s.start * HOUR, until)) {
      await store.repo('SaleTick').create({
        dealId: row.id,
        sku: s.sku,
        at: iso(t.at),
        units: t.units,
        revenue: Math.round(t.units * s.price * 100) / 100,
        source: 'seed',
        importedBy: owner.sub,
      });
    }
  }

  for (const n of NOTES) {
    const a = p[n.author];
    await store.repo('DealNote').create({ dealId: ids.get(n.sku)!, authorSub: a.sub, authorName: a.displayName, body: n.body, createdAt: iso(now - n.hoursAgo * HOUR) });
  }

  const grants: [number, 'merchandiser' | 'approver'][] = [
    [1, 'merchandiser'],
    [2, 'merchandiser'],
    [3, 'approver'],
  ];
  for (const [i, role] of grants) {
    await store.repo('DeskRole').create({ personSub: p[i].sub, personName: p[i].displayName, role, grantedBy: p[0].sub, grantedAt: iso(S - 72 * HOUR) });
  }
}
