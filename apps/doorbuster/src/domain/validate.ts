/**
 * Shopfront validation: field limits (the same numbers as the entity decorators), the margin guard and the
 * no-overlap rule for a SKU. Pure.
 */
import { checkText, formatDateTime, toMs } from '@x10/shared/lib';

import { rules } from '../config';
import { CATEGORIES, limits, type Category, type Deal } from '../model';
import { marginGuard, type GuardResult } from './pricing';

export interface DealInput {
  name: string;
  sku: string;
  category: Category;
  listPrice: number;
  unitCost: number;
  dealPrice: number;
  stockUnits: number;
  targetUnits: number;
  startsAt: string | null;
  endsAt: string | null;
  lossLeader: boolean;
  lossReason: string;
}

export type DealField = keyof DealInput;
export type DealErrors = Partial<Record<DealField, string>>;

/** SKUs are compared and stored upper-case, with spaces turned into dashes. */
export function normaliseSku(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '-');
}

const SKU_RE = /^[A-Z0-9][A-Z0-9._/-]*$/;
const MAX_PRICE = 1_000_000;
const MAX_UNITS = 1_000_000;

/** Two windows [a0, a1) and [b0, b1) overlap when each starts before the other ends. */
export function overlaps(a0: string, a1: string, b0: string, b1: string): boolean {
  return toMs(a0) < toMs(b1) && toMs(b0) < toMs(a1);
}

/** The other deal on the same SKU whose window overlaps, ignoring cancelled deals. */
export function findOverlap(input: Pick<DealInput, 'sku' | 'startsAt' | 'endsAt'>, deals: Deal[], selfId?: string): Deal | null {
  if (!input.startsAt || !input.endsAt) return null;
  const sku = normaliseSku(input.sku);
  return (
    deals.find(
      (d) => d.id !== selfId && d.status !== 'cancelled' && normaliseSku(d.sku) === sku && overlaps(input.startsAt!, input.endsAt!, d.startsAt, d.endsAt),
    ) ?? null
  );
}

function priceError(v: number, label: string, allowZero = false): string | null {
  if (!Number.isFinite(v)) return `${label} must be a number.`;
  if (allowZero ? v < 0 : v <= 0) return `${label} must be ${allowZero ? 'zero or more' : 'above zero'}.`;
  if (v > MAX_PRICE) return `${label} must be under ${MAX_PRICE.toLocaleString()}.`;
  if (Math.round(v * 100) !== Math.round(v * 100 * 1000) / 1000) return `${label} can have at most two decimals.`;
  return null;
}

function unitsError(v: number, label: string): string | null {
  if (!Number.isFinite(v) || !Number.isInteger(v)) return `${label} must be a whole number.`;
  if (v < 1) return `${label} must be at least 1.`;
  if (v > MAX_UNITS) return `${label} must be under ${MAX_UNITS.toLocaleString()}.`;
  return null;
}

export interface DealValidation {
  errors: DealErrors;
  guard: GuardResult;
  overlap: Deal | null;
  ok: boolean;
}

export function validateDeal(input: DealInput, deals: Deal[], selfId?: string): DealValidation {
  const e: DealErrors = {};
  const name = checkText(input.name, { ...limits.dealName, label: 'Name' });
  if (name) e.name = name;
  const sku = normaliseSku(input.sku);
  const skuMsg = checkText(sku, { ...limits.sku, label: 'SKU' });
  if (skuMsg) e.sku = skuMsg;
  else if (!SKU_RE.test(sku)) e.sku = 'SKU may use letters, digits, dots, dashes and slashes.';
  if (!CATEGORIES.includes(input.category)) e.category = 'Choose a category.';
  const lp = priceError(input.listPrice, 'List price');
  if (lp) e.listPrice = lp;
  const uc = priceError(input.unitCost, 'Unit cost', true);
  if (uc) e.unitCost = uc;
  const dp = priceError(input.dealPrice, 'Deal price');
  if (dp) e.dealPrice = dp;
  else if (!lp && input.dealPrice >= input.listPrice) e.dealPrice = 'A deal price must be below the list price.';
  const st = unitsError(input.stockUnits, 'Stock');
  if (st) e.stockUnits = st;
  const tg = unitsError(input.targetUnits, 'Target');
  if (tg) e.targetUnits = tg;
  else if (!st && input.targetUnits > input.stockUnits) e.targetUnits = 'The target cannot be more than the stock.';
  if (!input.startsAt) e.startsAt = 'Set when the deal starts.';
  if (!input.endsAt) e.endsAt = 'Set when the deal ends.';
  else if (input.startsAt && toMs(input.endsAt) <= toMs(input.startsAt)) e.endsAt = 'The deal must end after it starts.';
  const reason = input.lossReason.trim();
  if (reason.length > limits.lossReason.max) e.lossReason = `Reason must be ${limits.lossReason.max} characters or fewer (now ${reason.length}).`;

  const guard = marginGuard(input);
  if (input.lossLeader && guard.belowFloor && reason.length < rules.LOSS_REASON_MIN)
    e.lossReason = `Give a reason of at least ${rules.LOSS_REASON_MIN} characters (now ${reason.length}).`;
  if (guard.blocked && !e.dealPrice && !e.unitCost) e.dealPrice = guard.message ?? 'Below the margin floor.';

  const overlap = e.sku || e.startsAt || e.endsAt ? null : findOverlap({ ...input, sku }, deals, selfId);
  if (overlap)
    e.sku = `${sku} already has a deal in that window: ${overlap.name}, ${formatDateTime(overlap.startsAt)} to ${formatDateTime(overlap.endsAt)}.`;
  return { errors: e, guard, overlap, ok: Object.keys(e).length === 0 };
}
