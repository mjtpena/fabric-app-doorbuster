/**
 * The deal desk at a moment in time: every deal with its effective status, sales, forecast and lens groups, plus the
 * Today list. Pure: the arcade, the list view, the Velvet rope and the Ticker all read from this.
 */
import type { Person } from '@x10/shared/identity';
import { HOUR, MINUTE, formatDuration, toMs } from '@x10/shared/lib';

import { pct0, pct1, rules } from '../config';
import { CATEGORIES, CATEGORY_LABEL, type Approval, type Category, type Deal, type DealNote, type DeskRole, type SaleTick } from '../model';
import { crowdSize, forecast, lastHourUnits, revenueBy, soldBy, soldOutAt, type Forecast, type Projection } from './forecast';
import { DEEP_LABEL, FLOOR_LABEL, discountBand, discountOf, marginBand, marginOf, type DiscountBand, type MarginBand } from './pricing';
import { approverSubs, type Actor } from './roles';
import { effectiveStatus, statusLabel, statusTone, type Effective, type StatusTone } from './status';

export interface World {
  deals: Deal[];
  ticks: SaleTick[];
  notes: DealNote[];
  approvals: Approval[];
  roles: DeskRole[];
  people: Person[];
}

export type Risk = 'soldout' | 'early' | 'slow' | 'ontrack' | 'idle';
export const RISKS: Risk[] = ['soldout', 'early', 'slow', 'ontrack', 'idle'];

export interface DealView extends Effective {
  deal: Deal;
  ticks: SaleTick[];
  /** Units sold by the view time (may exceed stock if imports say so). */
  sold: number;
  /** sold / stock, capped at 1. */
  sellThrough: number;
  revenue: number;
  margin: number;
  discount: number;
  marginBand: MarginBand;
  discountBand: DiscountBand;
  belowFloor: boolean;
  soldOutAt: string | null;
  forecast: Forecast;
  risk: Risk;
  unitsLastHour: number;
  crowd: number;
  label: string;
  tone: StatusTone;
}

export interface Desk {
  /** The moment the desk shows (the arcade clock); ≤ now. */
  t: number;
  now: number;
  views: DealView[];
  approvers: Set<string>;
  day: { from: number; to: number };
}

function riskOf(e: Effective, f: Forecast, sold: number, target: number): Risk {
  if (e.soldOut) return 'soldout';
  if (e.status !== 'live') return 'idle';
  if (f.kind === 'early') return 'early';
  if (f.kind === 'lasts') return f.projectedUnits < target ? 'slow' : 'ontrack';
  if (f.kind === 'stalled') return 'slow';
  return sold >= target ? 'ontrack' : 'idle';
}

/** The 24-hour event window the arcade clock spans: from the first hour any current deal opened, containing now. */
export function eventDay(deals: Deal[], now: number): { from: number; to: number } {
  const floorHour = (v: number) => Math.floor(v / HOUR) * HOUR;
  const current = deals.filter((d) => d.status !== 'cancelled' && toMs(d.endsAt) > now - 12 * HOUR && toMs(d.startsAt) < now + 24 * HOUR);
  let from = current.length ? floorHour(Math.min(...current.map((d) => toMs(d.startsAt)))) : floorHour(now) - 10 * HOUR;
  if (now - from > 22 * HOUR) from = floorHour(now) - 20 * HOUR;
  if (from > now) from = floorHour(now);
  return { from, to: from + 24 * HOUR };
}

export function buildDesk(world: World, now: number, at?: number): Desk {
  const t = Math.min(at ?? now, now);
  const approvers = approverSubs(world.people, world.roles);
  const byDeal = new Map<string, SaleTick[]>();
  for (const k of world.ticks) byDeal.set(k.dealId, [...(byDeal.get(k.dealId) ?? []), k]);
  const views = world.deals.map((deal): DealView => {
    const all = (byDeal.get(deal.id) ?? []).sort((a, b) => toMs(a.at) - toMs(b.at));
    const ticks = all.filter((k) => toMs(k.at) <= t);
    const out = soldOutAt(ticks, deal.stockUnits);
    const eff = effectiveStatus(deal, world.approvals, approvers, out, t);
    const sold = soldBy(ticks, t);
    const f = forecast(deal, ticks, t);
    const margin = marginOf(deal.dealPrice, deal.unitCost);
    const discount = discountOf(deal.listPrice, deal.dealPrice);
    const unitsLastHour = eff.status === 'live' || (eff.soldOut && out && t - toMs(out) < HOUR) ? lastHourUnits(ticks, t) : 0;
    return {
      ...eff,
      deal,
      ticks: all,
      sold,
      sellThrough: deal.stockUnits > 0 ? Math.min(1, sold / deal.stockUnits) : 0,
      revenue: revenueBy(ticks, t),
      margin,
      discount,
      marginBand: marginBand(margin),
      discountBand: discountBand(discount),
      belowFloor: margin < rules.MIN_MARGIN,
      soldOutAt: out,
      forecast: f,
      risk: riskOf(eff, f, sold, deal.targetUnits),
      unitsLastHour,
      crowd: eff.status === 'live' ? crowdSize(unitsLastHour) : 0,
      label: statusLabel(eff),
      tone: statusTone(eff),
    };
  });
  return { t, now, views, approvers, day: eventDay(world.deals, now) };
}

/* ------------------------------------------------------------------ lenses */

export type Lens = 'sell' | 'margin' | 'discount' | 'risk' | 'category';
export const LENS_ORDER: Lens[] = ['sell', 'margin', 'discount', 'risk', 'category'];
export const LENS_LABEL: Record<Lens, string> = {
  sell: 'Sell-through',
  margin: 'Margin',
  discount: 'Discount',
  risk: 'Sell-out risk',
  category: 'Category',
};

export interface LensGroup {
  key: string;
  label: string;
  color: string;
}

export const CATEGORY_COLOR: Record<Category, string> = {
  electronics: 'var(--db-cat-electronics)',
  home: 'var(--db-cat-home)',
  fashion: 'var(--db-cat-fashion)',
  toys: 'var(--db-cat-toys)',
  beauty: 'var(--db-cat-beauty)',
  grocery: 'var(--db-cat-grocery)',
};

const MARGIN_GROUPS: LensGroup[] = [
  { key: 'below', label: `Below the ${FLOOR_LABEL} floor`, color: 'var(--db-neon-bad)' },
  { key: 'thin', label: `Thin, ${FLOOR_LABEL}–${pct0(rules.THIN_MARGIN)}`, color: 'var(--db-neon-warn)' },
  { key: 'healthy', label: `Healthy, ${pct0(rules.THIN_MARGIN)}–${pct0(rules.RICH_MARGIN)}`, color: 'var(--db-neon-ok)' },
  { key: 'rich', label: `Rich, ${pct0(rules.RICH_MARGIN)} and up`, color: 'var(--db-neon-info)' },
];
const DISCOUNT_GROUPS: LensGroup[] = [
  { key: 'light', label: `Under ${pct0(rules.LIGHT_DISCOUNT)} off`, color: 'var(--db-neon-info)' },
  { key: 'mid', label: `${pct0(rules.LIGHT_DISCOUNT)}–${DEEP_LABEL} off`, color: 'var(--db-neon-volt)' },
  { key: 'deep', label: `Deep, over ${DEEP_LABEL} off`, color: 'var(--db-neon-hot)' },
];
const RISK_GROUPS: LensGroup[] = [
  { key: 'soldout', label: 'Sold out', color: 'var(--db-neon-bad)' },
  { key: 'early', label: 'Sells out before it ends', color: 'var(--db-neon-warn)' },
  { key: 'slow', label: 'Short of target', color: 'var(--db-neon-info)' },
  { key: 'ontrack', label: 'On track', color: 'var(--db-neon-ok)' },
  { key: 'idle', label: 'Not selling now', color: 'var(--db-neon-idle)' },
];
const SELL_GROUPS: LensGroup[] = [
  { key: 's0', label: 'Under 25% sold', color: 'color-mix(in oklab, var(--db-neon-volt) 35%, var(--db-glass-dark))' },
  { key: 's1', label: '25–50% sold', color: 'color-mix(in oklab, var(--db-neon-volt) 60%, var(--db-glass-dark))' },
  { key: 's2', label: '50–75% sold', color: 'color-mix(in oklab, var(--db-neon-volt) 82%, white)' },
  { key: 's3', label: '75% sold and up', color: 'color-mix(in oklab, var(--db-neon-volt) 55%, white)' },
];

export function lensGroups(lens: Lens): LensGroup[] {
  switch (lens) {
    case 'sell':
      return SELL_GROUPS;
    case 'margin':
      return MARGIN_GROUPS;
    case 'discount':
      return DISCOUNT_GROUPS;
    case 'risk':
      return RISK_GROUPS;
    case 'category':
      return CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABEL[c], color: CATEGORY_COLOR[c] }));
  }
}

export function groupKey(v: DealView, lens: Lens): string {
  switch (lens) {
    case 'sell':
      return `s${Math.min(3, Math.floor(v.sellThrough * 4))}`;
    case 'margin':
      return v.marginBand;
    case 'discount':
      return v.discountBand;
    case 'risk':
      return v.risk;
    case 'category':
      return v.deal.category;
  }
}

/** The neon colour of a window under a lens (its light, its price tag and its row swatch). */
export function lensColor(v: DealView, lens: Lens): string {
  if (lens === 'sell') return 'var(--db-neon-volt)';
  return lensGroups(lens).find((g) => g.key === groupKey(v, lens))?.color ?? 'var(--db-neon-idle)';
}

export function groupLabel(v: DealView, lens: Lens): string {
  if (lens === 'sell') return `${pct0(v.sellThrough)} sold`;
  return lensGroups(lens).find((g) => g.key === groupKey(v, lens))?.label ?? '';
}

/* ------------------------------------------------------------------ view as */

export type ViewAs = 'all' | 'merchandiser' | 'approver';

export function defaultViewAs(a: Actor): ViewAs {
  if (a.isAdmin) return 'all';
  if (a.canApprove && !a.canMerch) return 'approver';
  if (a.canMerch) return 'merchandiser';
  return 'all';
}

/** Something a merchandiser would act on: a blocked or sent-back draft, or a live deal that runs out early. */
function merchWork(v: DealView): boolean {
  return (v.status === 'draft' && (v.belowFloor || !!v.sentBack)) || v.risk === 'early' || v.risk === 'slow';
}

/** Is this window one the viewer, in this role, looks at? (The others step back.) */
export function isRelevant(v: DealView, as: ViewAs, actor: Actor, views: DealView[]): boolean {
  if (as === 'all') return true;
  if (as === 'approver') return v.status === 'pending' || (v.needsApproval && v.status === 'live');
  const mine = views.some((x) => x.deal.ownerSub === actor.sub);
  return mine ? v.deal.ownerSub === actor.sub : merchWork(v);
}

/* ------------------------------------------------------------------ today */

export interface TodayEntry {
  id: string;
  dealId: string;
  title: string;
  severity: 'bad' | 'warn' | 'ok' | 'info';
  value: string;
  unit: string;
  lens: Lens;
  meta: string;
}

const clock = (ms: number) => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(ms);
export const formatClock = clock;

export function compactMoney(v: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

/** The three to five things that need attention now, ranked, for the role being viewed. */
export function todayFor(desk: Desk, as: ViewAs, actor: Actor): TodayEntry[] {
  const { views } = desk;
  const scope = as === 'merchandiser' && views.some((v) => v.deal.ownerSub === actor.sub) ? views.filter((v) => v.deal.ownerSub === actor.sub) : views;
  const out: TodayEntry[] = [];

  const soon = scope
    .filter((v) => v.status === 'live' && v.forecast.kind === 'early' && v.forecast.hoursToSellOut < rules.SELLOUT_SOON_HOURS)
    .sort((a, b) => (a.forecast as { hoursToSellOut: number }).hoursToSellOut - (b.forecast as { hoursToSellOut: number }).hoursToSellOut);
  const early = scope.filter((v) => v.status === 'live' && v.forecast.kind === 'early' && !soon.includes(v));
  const pending = views.filter((v) => v.status === 'pending').sort((a, b) => (a.deal.submittedAt ?? '').localeCompare(b.deal.submittedAt ?? ''));
  const below = scope.filter((v) => v.belowFloor && (v.status === 'draft' || !v.deal.lossLeader));
  const sentBack = scope.filter((v) => v.sentBack);
  const top = [...scope].filter((v) => v.revenue > 0).sort((a, b) => b.revenue - a.revenue)[0];

  const soonEntry = (v: DealView): TodayEntry => {
    const f = v.forecast as Projection;
    return {
      id: `soon-${v.deal.id}`,
      dealId: v.deal.id,
      title: `${v.deal.name} sells out around ${clock(toMs(f.at))}`,
      severity: 'bad',
      value: String(Math.max(1, Math.round((f.hoursToSellOut * HOUR) / MINUTE))),
      unit: 'min of stock',
      lens: 'risk',
      meta: `${formatDuration(f.hoursEarly * 60)} before the deal ends`,
    };
  };
  const earlyEntry = (v: DealView): TodayEntry => {
    const f = v.forecast as Projection;
    return {
      id: `early-${v.deal.id}`,
      dealId: v.deal.id,
      title: `${v.deal.name} sells out around ${clock(toMs(f.at))}`,
      severity: 'warn',
      value: `${f.hoursEarly >= 10 ? Math.round(f.hoursEarly) : f.hoursEarly.toFixed(1)} h`,
      unit: 'early',
      lens: 'risk',
      meta: `${Math.round(f.rate)} units an hour · ${f.remaining} left`,
    };
  };
  const pendingEntry = (): TodayEntry => {
    const first = pending.find((v) => v.deal.ownerSub !== actor.sub) ?? pending[0];
    const yours = first.deal.ownerSub === actor.sub;
    return {
      id: 'pending',
      dealId: first.deal.id,
      title: pending.length === 1 ? `${first.deal.name} waits at the velvet rope` : `${pending.length} deep discounts wait at the velvet rope`,
      severity: 'warn',
      value: String(pending.length),
      unit: pending.length === 1 ? 'to approve' : 'to approve',
      lens: 'discount',
      meta: `${first.deal.name} · ${pct0(first.discount)} off${yours ? ' · yours, needs another approver' : ` · ${first.deal.ownerName}`}`,
    };
  };
  const belowEntry = (v: DealView): TodayEntry => ({
    id: `floor-${v.deal.id}`,
    dealId: v.deal.id,
    title: `${v.deal.name} is below the ${FLOOR_LABEL} margin floor`,
    severity: 'bad',
    value: pct1(v.margin),
    unit: 'margin',
    lens: 'margin',
    meta: `${v.status === 'draft' ? 'Blocked draft' : v.label} · ${v.deal.ownerName}`,
  });
  const sentEntry = (v: DealView): TodayEntry => ({
    id: `sent-${v.deal.id}`,
    dealId: v.deal.id,
    title: `${v.deal.name} was sent back by ${v.sentBack!.approverName}`,
    severity: 'warn',
    value: pct0(v.discount),
    unit: 'off',
    lens: 'discount',
    meta: v.sentBack!.note ?? 'No note',
  });
  const topEntry = (v: DealView): TodayEntry => ({
    id: `top-${v.deal.id}`,
    dealId: v.deal.id,
    title: `Top seller: ${v.deal.name}`,
    severity: 'ok',
    value: compactMoney(v.revenue),
    unit: 'revenue',
    lens: 'sell',
    meta: `${v.sold.toLocaleString()} units · ${pct0(v.sellThrough)} of stock${v.soldOut ? ' · sold out' : ''}`,
  });

  if (as === 'approver') {
    for (const v of pending.slice(0, 3)) {
      const yours = v.deal.ownerSub === actor.sub;
      out.push({
        id: `rope-${v.deal.id}`,
        dealId: v.deal.id,
        title: `${v.deal.name} waits at the velvet rope`,
        severity: 'warn',
        value: pct0(v.discount),
        unit: 'off',
        lens: 'discount',
        meta: `${v.deal.lossLeader ? 'Loss leader · ' : ''}${pct1(v.margin)} margin · ${yours ? 'yours, needs another approver' : v.deal.ownerName}`,
      });
    }
    below.slice(0, 1).forEach((v) => out.push(belowEntry(v)));
    soon.slice(0, 1).forEach((v) => out.push(soonEntry(v)));
    if (top) out.push(topEntry(top));
    return out.slice(0, 5);
  }
  soon.slice(0, 2).forEach((v) => out.push(soonEntry(v)));
  if (as === 'all' && pending.length) out.push(pendingEntry());
  below.slice(0, 1).forEach((v) => out.push(belowEntry(v)));
  sentBack.slice(0, 1).forEach((v) => out.push(sentEntry(v)));
  early.slice(0, 1).forEach((v) => out.push(earlyEntry(v)));
  if (top) out.push(topEntry(top));
  return out.slice(0, 5);
}

/** A sentence for the forecast, used by the Ticker, the list and the arcade's focus card. */
export function forecastText(f: Forecast, endsAt: string): string {
  switch (f.kind) {
    case 'notStarted':
      return `Opens ${clock(toMs(f.startsAt))}`;
    case 'soldOut':
      return `Sold out at ${clock(toMs(f.at))}${f.early ? `, ${formatDuration((toMs(endsAt) - toMs(f.at)) / MINUTE)} early` : ''}`;
    case 'ended':
      return 'Ended';
    case 'tooEarly':
      return 'Too early to forecast';
    case 'stalled':
      return `No sales in the last ${rules.RATE_WINDOW_HOURS} h`;
    case 'early':
      return `Sells out ~${clock(toMs(f.at))}, ${formatDuration(f.hoursEarly * 60)} early`;
    case 'lasts':
      return `Lasts to the end · ~${f.projectedUnits.toLocaleString()} sold by ${clock(toMs(endsAt))}`;
  }
}
