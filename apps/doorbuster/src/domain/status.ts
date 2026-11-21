/**
 * Status follows time. The owner stores draft, pending, approved or cancelled; whether a deal is approved comes from
 * Velvet rope decisions, and live / ended (and sold out) come from the clock and the sales. Nothing time-driven is
 * stored, so there is no drift to repair.
 */
import { toMs } from '@x10/shared/lib';

import type { Approval, Deal, DealStatus } from '../model';
import { requiresApproval, termsKey } from './pricing';

/**
 * The decision that counts for the deal's current terms at time `t`: the newest one by an approver other than the
 * owner, on these exact prices, made after the last submission. Everything else is ignored.
 */
export function currentDecision(deal: Deal, approvals: Approval[], approvers: Set<string>, t = Number.POSITIVE_INFINITY): Approval | null {
  const key = termsKey(deal);
  const since = deal.submittedAt ? toMs(deal.submittedAt) : Number.NEGATIVE_INFINITY;
  const valid = approvals.filter(
    (a) =>
      a.dealId === deal.id &&
      a.dealOwnerSub === deal.ownerSub &&
      a.approverSub !== deal.ownerSub &&
      approvers.has(a.approverSub) &&
      a.termsKey === key &&
      toMs(a.decidedAt) >= since &&
      toMs(a.decidedAt) <= t,
  );
  if (!valid.length) return null;
  return valid.reduce((a, b) => (toMs(b.decidedAt) > toMs(a.decidedAt) ? b : a));
}

export interface Effective {
  status: DealStatus;
  /** Ended because stock ran out (the window closed early). */
  soldOut: boolean;
  /** The approval behind an approved deal that needed one. */
  approval: Approval | null;
  /** The approver's send-back, when the deal is back in draft because of it. */
  sentBack: Approval | null;
  needsApproval: boolean;
}

/**
 * Effective status at time `t`. `soldOutAt` is when cumulative sales reached stock (null while stock remains).
 * A deal that needs approval and never got it before its end is ended without having run.
 */
export function effectiveStatus(deal: Deal, approvals: Approval[], approvers: Set<string>, soldOutAt: string | null, t: number): Effective {
  const needsApproval = requiresApproval(deal);
  const base = { soldOut: false, approval: null, sentBack: null, needsApproval };
  if (deal.status === 'cancelled') return { ...base, status: 'cancelled' };
  if (deal.status === 'draft') return { ...base, status: 'draft' };
  const decision = needsApproval ? currentDecision(deal, approvals, approvers, t) : null;
  if (needsApproval && decision?.decision === 'sent_back') return { ...base, status: 'draft', sentBack: decision };
  const start = toMs(deal.startsAt);
  const end = toMs(deal.endsAt);
  if (needsApproval && decision?.decision !== 'approved') return { ...base, status: t >= end ? 'ended' : 'pending' };
  const approval = needsApproval ? decision : null;
  if (soldOutAt && toMs(soldOutAt) <= t) return { ...base, approval, status: 'ended', soldOut: true };
  if (t < start) return { ...base, approval, status: 'approved' };
  if (t >= end) return { ...base, approval, status: 'ended' };
  return { ...base, approval, status: 'live' };
}

/** Plain-language status for tables and the arcade's labels. */
export function statusLabel(e: Pick<Effective, 'status' | 'soldOut' | 'sentBack'>): string {
  if (e.soldOut) return 'Sold out';
  if (e.sentBack) return 'Sent back';
  switch (e.status) {
    case 'draft':
      return 'Draft';
    case 'pending':
      return 'Awaiting approval';
    case 'approved':
      return 'Scheduled';
    case 'live':
      return 'Live';
    case 'ended':
      return 'Ended';
    case 'cancelled':
      return 'Cancelled';
  }
}

export type StatusTone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

export function statusTone(e: Pick<Effective, 'status' | 'soldOut' | 'sentBack'>): StatusTone {
  if (e.soldOut) return 'bad';
  if (e.sentBack) return 'warn';
  switch (e.status) {
    case 'pending':
      return 'warn';
    case 'approved':
      return 'info';
    case 'live':
      return 'ok';
    default:
      return 'neutral';
  }
}
