import { discountBand, discountOf, isDeep, marginBand, marginGuard, marginOf, requiresApproval, termsKey } from './pricing';

const terms = (dealPrice: number, unitCost: number, listPrice = 100, lossLeader = false) => ({ dealPrice, unitCost, listPrice, lossLeader });

describe('margin and discount', () => {
  it('computes margin on the deal price and discount off the list price', () => {
    expect(marginOf(50, 40)).toBeCloseTo(0.2);
    expect(discountOf(100, 60)).toBeCloseTo(0.4);
    expect(marginOf(9.99, 11)).toBeCloseTo(-0.101, 3);
  });

  it('has no margin without a price and no discount without a list price', () => {
    expect(marginOf(0, 5)).toBe(Number.NEGATIVE_INFINITY);
    expect(marginOf(Number.NaN, 5)).toBe(Number.NEGATIVE_INFINITY);
    expect(discountOf(0, 10)).toBe(0);
  });

  it('treats exactly 8% margin as on the floor (not below) despite float noise', () => {
    // 25 − 23 = 2, 2 / 25 = 0.08 exactly; 0.1 + 0.2 style noise must not tip it under.
    expect(marginOf(25, 23)).toBe(0.08);
    expect(marginBand(marginOf(25, 23))).toBe('thin');
    expect(marginGuard(terms(25, 23)).blocked).toBe(false);
    expect(marginGuard(terms(25, 23.01)).blocked).toBe(true);
  });

  it('bands margins and discounts', () => {
    expect(marginBand(0.05)).toBe('below');
    expect(marginBand(0.1)).toBe('thin');
    expect(marginBand(0.2)).toBe('healthy');
    expect(marginBand(0.3)).toBe('rich');
    expect(discountBand(0.1)).toBe('light');
    expect(discountBand(0.2)).toBe('mid');
    expect(discountBand(0.4)).toBe('mid');
    expect(discountBand(0.41)).toBe('deep');
  });

  it('needs approval strictly above 40% off, and always for a loss leader', () => {
    expect(isDeep(0.4)).toBe(false);
    expect(isDeep(0.4001)).toBe(true);
    expect(requiresApproval(terms(60, 10))).toBe(false);
    expect(requiresApproval(terms(59, 10))).toBe(true);
    expect(requiresApproval(terms(90, 10, 100, true))).toBe(true);
  });
});

describe('margin guard', () => {
  it('blocks below the floor and shows the computed margin', () => {
    const g = marginGuard(terms(46, 44, 79));
    expect(g.blocked).toBe(true);
    expect(g.margin).toBeCloseTo(0.0435, 3);
    expect(g.message).toBe('Margin 4.3% is below the 8% floor. Raise the price, lower the cost, or flag it as a loss leader.');
  });

  it('lets a loss leader through only with a reason of 20+ characters', () => {
    const short = marginGuard({ ...terms(9.99, 11, 24, true), lossReason: 'Traffic driver' });
    expect(short.blocked).toBe(true);
    expect(short.message).toMatch(/needs a reason of 20 characters/);
    const ok = marginGuard({ ...terms(9.99, 11, 24, true), lossReason: 'Traffic driver for the aisle' });
    expect(ok).toMatchObject({ blocked: false, lossLeaderOk: true, needsApproval: true });
    // Twenty spaces are not a reason.
    expect(marginGuard({ ...terms(9.99, 11, 24, true), lossReason: ' '.repeat(25) }).blocked).toBe(true);
  });

  it('blocks a zero price with a plain message', () => {
    expect(marginGuard(terms(0, 5)).message).toBe('Set a deal price above zero.');
  });

  it('binds an approval to the prices and the loss-leader flag', () => {
    const a = termsKey(terms(59, 10));
    expect(termsKey(terms(59.0, 10.0))).toBe(a);
    expect(termsKey(terms(58.99, 10))).not.toBe(a);
    expect(termsKey(terms(59, 10, 100, true))).not.toBe(a);
  });
});
