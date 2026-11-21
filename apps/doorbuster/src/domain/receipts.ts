/**
 * Receipts: CSV import of sales ticks with the header `sku,at,units,revenue`. Every row is checked on its own, so a
 * bad row (unknown SKU, a time outside every deal window, a duplicate) shows its error and the rest still import.
 */
import { parseCsv, toLocalInput, toMs } from '@x10/shared/lib';

import { rules } from '../config';
import type { Deal, SaleTick } from '../model';
import { normaliseSku } from './validate';

export const RECEIPT_COLUMNS = ['sku', 'at', 'units', 'revenue'] as const;

export interface ReceiptRow {
  /** 1-based line number in the file (the header is line 1). */
  line: number;
  sku: string;
  at: string | null;
  units: number;
  revenue: number;
  dealId: string | null;
  dealName: string | null;
  error: string | null;
}

export interface ReceiptParse {
  rows: ReceiptRow[];
  /** A problem with the whole file (no header, too many rows); nothing imports. */
  fileError: string | null;
  ok: number;
  bad: number;
}

/** Strip currency symbols, spaces and thousands separators: "$1,299.50" → 1299.5. */
export function parseMoney(s: string): number {
  const t = s.trim().replace(/[\s$€£¥,]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return Number.NaN;
  return Number(t);
}

/** ISO date-times only (with or without seconds and zone); a bare date is refused because sales need a time. */
export function parseWhen(s: string): string | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(t)) return null;
  const ms = Date.parse(t.replace(' ', 'T'));
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

const tickKey = (sku: string, at: string, units: number) => `${normaliseSku(sku)}|${toMs(at)}|${units}`;

/**
 * Check a CSV against the deals. `notSelling` names deals that cannot have sales whatever the time says (a deep
 * discount still waiting for approval), with the reason shown on the row.
 */
export function parseReceipts(
  text: string,
  deals: Deal[],
  existing: Pick<SaleTick, 'sku' | 'at' | 'units'>[],
  now: Date,
  notSelling: Map<string, string> = new Map(),
): ReceiptParse {
  const table = parseCsv(text);
  const empty = (fileError: string): ReceiptParse => ({ rows: [], fileError, ok: 0, bad: 0 });
  if (!table.length) return empty('The file is empty. The first line must be the header sku,at,units,revenue.');
  const header = table[0].map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(RECEIPT_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<(typeof RECEIPT_COLUMNS)[number], number>;
  const missing = RECEIPT_COLUMNS.filter((c) => idx[c] < 0);
  if (missing.length) return empty(`The header is missing ${missing.join(', ')}. Expected sku,at,units,revenue.`);
  const body = table.slice(1);
  if (!body.length) return empty('The file has a header but no rows.');
  if (body.length > rules.IMPORT_MAX_ROWS) return empty(`The file has ${body.length} rows; import at most ${rules.IMPORT_MAX_ROWS} at a time.`);

  const bySku = new Map<string, Deal[]>();
  for (const d of deals) {
    const k = normaliseSku(d.sku);
    bySku.set(k, [...(bySku.get(k) ?? []), d]);
  }
  const seen = new Set(existing.map((t) => tickKey(t.sku, t.at, t.units)));
  const horizon = now.getTime() + 5 * 60_000;

  const rows: ReceiptRow[] = body.map((cells, i) => {
    const line = i + 2;
    const raw = (c: (typeof RECEIPT_COLUMNS)[number]) => (cells[idx[c]] ?? '').trim();
    const sku = normaliseSku(raw('sku'));
    const at = parseWhen(raw('at'));
    const unitsRaw = raw('units');
    const units = /^\d+$/.test(unitsRaw) ? Number(unitsRaw) : Number.NaN;
    const revenue = parseMoney(raw('revenue'));
    const row: ReceiptRow = { line, sku, at, units, revenue, dealId: null, dealName: null, error: null };
    const fail = (error: string) => ({ ...row, error });
    if (!sku) return fail('SKU is empty.');
    const candidates = bySku.get(sku);
    if (!candidates) return fail(`Unknown SKU ${sku}: no deal sells it.`);
    if (!at) return fail(`"${raw('at')}" is not a date and time (use 2026-11-30T09:15).`);
    if (toMs(at) > horizon) return fail('The time is in the future.');
    if (!Number.isFinite(units) || units < 1) return fail(`Units must be a whole number of 1 or more (got "${unitsRaw}").`);
    if (units > rules.MAX_TICK_UNITS) return fail(`${units} units in one row is more than ${rules.MAX_TICK_UNITS.toLocaleString()}; check the columns.`);
    if (!Number.isFinite(revenue) || revenue < 0) return fail(`Revenue must be a number of 0 or more (got "${raw('revenue')}").`);
    const deal = candidates.find((d) => d.status !== 'cancelled' && d.status !== 'draft' && toMs(d.startsAt) < toMs(at) && toMs(at) <= toMs(d.endsAt));
    if (!deal) {
      const live = candidates.filter((d) => d.status !== 'cancelled' && d.status !== 'draft');
      return fail(live.length ? `No ${sku} deal was running at that time.` : `The ${sku} deal is ${candidates[0].status}; it cannot have sales.`);
    }
    const blocked = notSelling.get(deal.id);
    if (blocked) return fail(`${deal.name} ${blocked}; it cannot have sales yet.`);
    const key = tickKey(sku, at, units);
    if (seen.has(key)) return fail('Already imported (same SKU, time and units).');
    seen.add(key);
    return { ...row, dealId: deal.id, dealName: deal.name };
  });
  const ok = rows.filter((r) => !r.error).length;
  return { rows, fileError: null, ok, bad: rows.length - ok };
}

/** A template file with two good rows and one deliberate unknown SKU. */
export function receiptTemplate(deals: Deal[], now: Date): string {
  const live = deals.filter((d) => d.status !== 'cancelled' && d.status !== 'draft' && toMs(d.startsAt) < now.getTime() && now.getTime() <= toMs(d.endsAt));
  const pick = live.slice(0, 2);
  // Local time without a zone, the way a till export usually writes it (parseWhen reads it as local time).
  const at = toLocalInput(new Date(Math.floor(now.getTime() / 60_000) * 60_000 - 60_000).toISOString());
  const lines = ['sku,at,units,revenue', ...pick.map((d) => `${d.sku},${at},3,${(d.dealPrice * 3).toFixed(2)}`), `XX-UNKNOWN-1,${at},2,40.00`];
  return lines.join('\n') + '\n';
}
