/**
 * Sell-through and the sell-out forecast, from the sales ticks. Pure functions; times are ms or ISO strings.
 * A tick at time t carries the units sold in the interval ending at t.
 */
import { HOUR, MINUTE, toMs } from '@x10/shared/lib';

import { rules } from '../config';

export interface TickLike {
  at: string;
  units: number;
  revenue: number;
}

export function sortTicks<T extends TickLike>(ticks: T[]): T[] {
  return [...ticks].sort((a, b) => toMs(a.at) - toMs(b.at));
}

/** Units sold at or before `t`. */
export function soldBy(ticks: TickLike[], t: number): number {
  let n = 0;
  for (const k of ticks) if (toMs(k.at) <= t) n += k.units;
  return n;
}

export function revenueBy(ticks: TickLike[], t: number): number {
  let n = 0;
  for (const k of ticks) if (toMs(k.at) <= t) n += k.revenue;
  return Math.round(n * 100) / 100;
}

/** Units sold in the interval (from, to]. */
export function unitsBetween(ticks: TickLike[], from: number, to: number): number {
  let n = 0;
  for (const k of ticks) {
    const at = toMs(k.at);
    if (at > from && at <= to) n += k.units;
  }
  return n;
}

/** The time of the tick that took cumulative sales to the stock level, or null while stock remains. */
export function soldOutAt(ticks: TickLike[], stockUnits: number): string | null {
  if (stockUnits <= 0) return null;
  let n = 0;
  for (const k of sortTicks(ticks)) {
    n += k.units;
    if (n >= stockUnits) return k.at;
  }
  return null;
}

/** Units in the last hour before `t`: the queue outside the window. */
export function lastHourUnits(ticks: TickLike[], t: number): number {
  return unitsBetween(ticks, t - HOUR, t);
}

/** One silhouette per CROWD_UNITS_PER_SHOPPER units an hour, at least one while anything sold, capped. */
export function crowdSize(unitsLastHour: number): number {
  if (unitsLastHour <= 0) return 0;
  return Math.min(rules.CROWD_MAX, Math.max(1, Math.round(unitsLastHour / rules.CROWD_UNITS_PER_SHOPPER)));
}

export interface SaleWindow {
  startsAt: string;
  endsAt: string;
  stockUnits: number;
  targetUnits: number;
}

/** Units per hour over the last RATE_WINDOW_HOURS (or since the start, if it started more recently). */
export function salesRate(ticks: TickLike[], startsAt: string, t: number): { rate: number; hours: number } | null {
  const from = Math.max(toMs(startsAt), t - rules.RATE_WINDOW_HOURS * HOUR);
  const span = t - from;
  if (span < rules.MIN_RATE_MINUTES * MINUTE) return null;
  const hours = span / HOUR;
  return { rate: unitsBetween(ticks, from, t) / hours, hours };
}

export type Projection = {
  kind: 'early' | 'lasts';
  /** Projected sell-out time. */
  at: string;
  rate: number;
  remaining: number;
  /** Hours from now until the projected sell-out. */
  hoursToSellOut: number;
  /** Hours between the projected sell-out and the deal's end (positive = sells out early). */
  hoursEarly: number;
  /** Units projected to be sold by the end, capped at stock. */
  projectedUnits: number;
};

export type Forecast =
  | { kind: 'notStarted'; startsAt: string }
  | { kind: 'soldOut'; at: string; early: boolean }
  | { kind: 'ended' }
  | { kind: 'tooEarly' }
  | { kind: 'stalled'; remaining: number }
  | Projection;

/**
 * The sell-out forecast at time `now`: units sold per hour over the last window project when stock reaches zero.
 * "early" (a warning) when that is before the deal ends; "soldOut" when it already happened (the window ends early).
 */
export function forecast(w: SaleWindow, ticks: TickLike[], now: number): Forecast {
  const seen = ticks.filter((k) => toMs(k.at) <= now);
  const out = soldOutAt(seen, w.stockUnits);
  if (out) return { kind: 'soldOut', at: out, early: toMs(out) < toMs(w.endsAt) };
  const start = toMs(w.startsAt);
  const end = toMs(w.endsAt);
  if (now < start) return { kind: 'notStarted', startsAt: w.startsAt };
  if (now >= end) return { kind: 'ended' };
  const r = salesRate(seen, w.startsAt, now);
  if (!r) return { kind: 'tooEarly' };
  const sold = soldBy(seen, now);
  const remaining = Math.max(0, w.stockUnits - sold);
  if (r.rate <= 0) return { kind: 'stalled', remaining };
  const hoursToSellOut = remaining / r.rate;
  const at = now + hoursToSellOut * HOUR;
  const hoursToEnd = (end - now) / HOUR;
  const projectedUnits = Math.min(w.stockUnits, Math.round(sold + r.rate * hoursToEnd));
  return {
    kind: at < end ? 'early' : 'lasts',
    at: new Date(at).toISOString(),
    rate: r.rate,
    remaining,
    hoursToSellOut,
    hoursEarly: (end - at) / HOUR,
    projectedUnits,
  };
}

/** Units per bucket and the running total, for buckets ending at from+b, from+2b, … ≤ to. */
export function cumulativeSeries(ticks: TickLike[], from: number, to: number, bucketMs: number): { t: number; units: number; sold: number }[] {
  const out: { t: number; units: number; sold: number }[] = [];
  const sorted = sortTicks(ticks);
  let i = 0;
  let sold = 0;
  while (i < sorted.length && toMs(sorted[i].at) <= from) sold += sorted[i++].units;
  for (let t = from + bucketMs; t <= to + 1; t += bucketMs) {
    let units = 0;
    while (i < sorted.length && toMs(sorted[i].at) <= t) units += sorted[i++].units;
    sold += units;
    out.push({ t, units, sold });
  }
  return out;
}
