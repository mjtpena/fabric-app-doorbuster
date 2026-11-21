import type { Approval, Deal } from '../model';
import { termsKey } from './pricing';
import { currentDecision, effectiveStatus, statusLabel } from './status';

const H = 3_600_000;
const T0 = Date.parse('2026-11-30T00:00:00Z');
const at = (h: number) => new Date(T0 + h * H).toISOString();

const deal = (over: Partial<Deal> = {}): Deal => ({
  id: 'd1',
  name: 'Test deal',
  sku: 'SKU-1',
  category: 'toys',
  listPrice: 100,
  unitCost: 20,
  dealPrice: 50,
  stockUnits: 100,
  targetUnits: 80,
  startsAt: at(2),
  endsAt: at(10),
  status: 'pending',
  lossLeader: false,
  lossReason: null,
  ownerSub: 'owner',
  ownerName: 'Owner',
  submittedAt: at(-5),
  createdAt: at(-6),
  updatedAt: at(-5),
  ...over,
});

const approval = (d: Deal, over: Partial<Approval> = {}): Approval => ({
  id: 'a1',
  dealId: d.id,
  dealOwnerSub: d.ownerSub,
  approverSub: 'approver',
  approverName: 'Approver',
  decision: 'approved',
  termsKey: termsKey(d),
  note: null,
  decidedAt: at(-4),
  ...over,
});

const approvers = new Set(['approver', 'admin']);

describe('effective status', () => {
  it('follows time once approved: scheduled, live, ended', () => {
    const d = deal();
    const a = [approval(d)];
    expect(effectiveStatus(d, a, approvers, null, T0).status).toBe('approved');
    expect(effectiveStatus(d, a, approvers, null, T0 + 3 * H).status).toBe('live');
    expect(effectiveStatus(d, a, approvers, null, T0 + 10 * H).status).toBe('ended');
  });

  it('ends early when sold out', () => {
    const d = deal();
    const e = effectiveStatus(d, [approval(d)], approvers, at(5), T0 + 6 * H);
    expect(e).toMatchObject({ status: 'ended', soldOut: true });
    expect(statusLabel(e)).toBe('Sold out');
    expect(effectiveStatus(d, [approval(d)], approvers, at(5), T0 + 4 * H).status).toBe('live');
  });

  it('keeps a deep discount pending without a valid approval, even if the owner stored "approved"', () => {
    const d = deal({ status: 'approved' });
    expect(effectiveStatus(d, [], approvers, null, T0 + 3 * H).status).toBe('pending');
    // Past its end without approval it is ended, never having run.
    expect(effectiveStatus(d, [], approvers, null, T0 + 11 * H).status).toBe('ended');
  });

  it('runs a light discount without any approval', () => {
    const d = deal({ dealPrice: 70, status: 'approved' });
    expect(effectiveStatus(d, [], approvers, null, T0 + 3 * H).status).toBe('live');
  });

  it('ignores self-approval, forged owners, non-approvers, stale terms and old decisions', () => {
    const d = deal();
    const bad = [
      approval(d, { approverSub: 'owner' }),
      approval(d, { dealOwnerSub: 'someone-else', approverSub: 'owner' }),
      approval(d, { approverSub: 'random-user' }),
      approval(d, { termsKey: termsKey({ ...d, dealPrice: 60 }) }),
      approval(d, { decidedAt: at(-6) }),
      approval(d, { dealId: 'other' }),
    ];
    for (const a of bad) expect(currentDecision(d, [a], approvers), JSON.stringify(a)).toBeNull();
    expect(effectiveStatus(d, bad, approvers, null, T0 + 3 * H).status).toBe('pending');
  });

  it('takes the newest valid decision, and a send-back returns the deal to draft', () => {
    const d = deal();
    const a = [approval(d, { id: 'x', decidedAt: at(-4) }), approval(d, { id: 'y', decision: 'sent_back', note: 'Too deep', decidedAt: at(-3) })];
    const e = effectiveStatus(d, a, approvers, null, T0 + 3 * H);
    expect(e.status).toBe('draft');
    expect(e.sentBack?.id).toBe('y');
    expect(statusLabel(e)).toBe('Sent back');
  });

  it('replays: a decision made after the moment shown does not count yet', () => {
    const d = deal({ startsAt: at(-10) });
    const a = [approval(d, { decidedAt: at(1) })];
    expect(effectiveStatus(d, a, approvers, null, T0).status).toBe('pending');
    expect(effectiveStatus(d, a, approvers, null, T0 + 2 * H).status).toBe('live');
  });

  it('keeps drafts and cancelled deals as stored', () => {
    expect(effectiveStatus(deal({ status: 'draft' }), [], approvers, null, T0).status).toBe('draft');
    expect(effectiveStatus(deal({ status: 'cancelled' }), [], approvers, at(1), T0 + 5 * H).status).toBe('cancelled');
  });
});
