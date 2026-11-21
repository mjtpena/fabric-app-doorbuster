/**
 * Pricing rules: margin, discount, the margin guard and when a deal needs a second person. Pure functions.
 */
import { rules } from '../config';

/** Round away floating-point noise so 8.0000001% and 7.9999999% compare as 8%. */
const tidy = (v: number) => Math.round(v * 1e6) / 1e6;

/** (dealPrice − unitCost) / dealPrice. A zero or negative price has no margin (−∞). */
export function marginOf(dealPrice: number, unitCost: number): number {
  if (!Number.isFinite(dealPrice) || !Number.isFinite(unitCost) || dealPrice <= 0) return Number.NEGATIVE_INFINITY;
  return tidy((dealPrice - unitCost) / dealPrice);
}

/** 1 − dealPrice / listPrice. No list price, no discount. */
export function discountOf(listPrice: number, dealPrice: number): number {
  if (!Number.isFinite(listPrice) || !Number.isFinite(dealPrice) || listPrice <= 0) return 0;
  return tidy(1 - dealPrice / listPrice);
}

export type MarginBand = 'below' | 'thin' | 'healthy' | 'rich';
export const MARGIN_BANDS: MarginBand[] = ['below', 'thin', 'healthy', 'rich'];

export function marginBand(m: number): MarginBand {
  if (m < rules.MIN_MARGIN) return 'below';
  if (m < rules.THIN_MARGIN) return 'thin';
  if (m < rules.RICH_MARGIN) return 'healthy';
  return 'rich';
}

export type DiscountBand = 'light' | 'mid' | 'deep';
export const DISCOUNT_BANDS: DiscountBand[] = ['light', 'mid', 'deep'];

/** Deep means strictly above DEEP_DISCOUNT: exactly 40% off does not need approval. */
export const isDeep = (d: number) => d > rules.DEEP_DISCOUNT;

export function discountBand(d: number): DiscountBand {
  if (isDeep(d)) return 'deep';
  if (d >= rules.LIGHT_DISCOUNT) return 'mid';
  return 'light';
}

export interface Terms {
  listPrice: number;
  unitCost: number;
  dealPrice: number;
  lossLeader: boolean;
}

/** A deep discount or a loss leader always needs approval by someone other than the owner. */
export function requiresApproval(t: Terms): boolean {
  return t.lossLeader || isDeep(discountOf(t.listPrice, t.dealPrice));
}

const cents = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) : 'x');

/** The terms an approver signs off. Changing any of them sends the deal back to the velvet rope. */
export function termsKey(t: Terms): string {
  return `${cents(t.listPrice)}|${cents(t.unitCost)}|${cents(t.dealPrice)}|${t.lossLeader ? 'LL' : '-'}`;
}

export interface GuardResult {
  margin: number;
  discount: number;
  /** Margin is under MIN_MARGIN. */
  belowFloor: boolean;
  /** Below the floor but flagged as a loss leader with a long enough reason. */
  lossLeaderOk: boolean;
  /** Saving is refused. */
  blocked: boolean;
  needsApproval: boolean;
  /** Why it is blocked (shown next to the save button), or null. */
  message: string | null;
}

export function formatMargin(m: number): string {
  return Number.isFinite(m) ? `${(m * 100).toFixed(1)}%` : '—';
}

export const FLOOR_LABEL = `${Math.round(rules.MIN_MARGIN * 100)}%`;
export const DEEP_LABEL = `${Math.round(rules.DEEP_DISCOUNT * 100)}%`;

/** The live margin guard behind the Shopfront: what the save button will do with these terms. */
export function marginGuard(t: Terms & { lossReason?: string | null }): GuardResult {
  const margin = marginOf(t.dealPrice, t.unitCost);
  const discount = discountOf(t.listPrice, t.dealPrice);
  const belowFloor = margin < rules.MIN_MARGIN;
  const reasonOk = (t.lossReason ?? '').trim().length >= rules.LOSS_REASON_MIN;
  const lossLeaderOk = belowFloor && Number.isFinite(margin) && t.lossLeader && reasonOk;
  const blocked = belowFloor && !lossLeaderOk;
  let message: string | null = null;
  if (blocked) {
    message = !Number.isFinite(margin)
      ? 'Set a deal price above zero.'
      : t.lossLeader
        ? `Margin ${formatMargin(margin)} is below the ${FLOOR_LABEL} floor. A loss leader needs a reason of ${rules.LOSS_REASON_MIN} characters or more.`
        : `Margin ${formatMargin(margin)} is below the ${FLOOR_LABEL} floor. Raise the price, lower the cost, or flag it as a loss leader.`;
  }
  return { margin, discount, belowFloor, lossLeaderOk, blocked, needsApproval: requiresApproval(t), message };
}
