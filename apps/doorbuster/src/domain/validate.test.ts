import type { Deal } from '../model';
import { findOverlap, normaliseSku, overlaps, validateDeal, type DealInput } from './validate';

const H = 3_600_000;
const T0 = Date.parse('2026-11-30T00:00:00Z');
const at = (h: number) => new Date(T0 + h * H).toISOString();

const input = (over: Partial<DealInput> = {}): DealInput => ({
  name: 'Snow globe lamp',
  sku: 'hm-sg-001',
  category: 'home',
  listPrice: 80,
  unitCost: 30,
  dealPrice: 59,
  stockUnits: 100,
  targetUnits: 80,
  startsAt: at(1),
  endsAt: at(9),
  lossLeader: false,
  lossReason: '',
  ...over,
});

const existing = (over: Partial<Deal> = {}): Deal => ({
  id: 'e1',
  name: 'Earlier lamp deal',
  sku: 'HM-SG-001',
  category: 'home',
  listPrice: 80,
  unitCost: 30,
  dealPrice: 60,
  stockUnits: 50,
  targetUnits: 40,
  startsAt: at(8),
  endsAt: at(12),
  status: 'approved',
  lossLeader: false,
  lossReason: null,
  ownerSub: 'x',
  ownerName: 'X',
  submittedAt: at(-1),
  createdAt: at(-2),
  updatedAt: at(-1),
  ...over,
});

describe('deal validation', () => {
  it('accepts a sound deal', () => {
    expect(validateDeal(input(), []).ok).toBe(true);
  });

  it('checks the entity limits and the numbers', () => {
    const v = validateDeal(input({ name: 'ab', sku: '', stockUnits: 2.5, targetUnits: 0, dealPrice: 90, unitCost: -1 }), []);
    expect(v.errors.name).toMatch(/at least 3/);
    expect(v.errors.sku).toMatch(/required/);
    expect(v.errors.stockUnits).toMatch(/whole number/);
    expect(v.errors.targetUnits).toMatch(/at least 1/);
    expect(v.errors.dealPrice).toMatch(/below the list price/);
    expect(v.errors.unitCost).toMatch(/zero or more/);
    expect(validateDeal(input({ name: 'x'.repeat(81) }), []).errors.name).toMatch(/80 characters or fewer/);
    expect(validateDeal(input({ dealPrice: 19.999 }), []).errors.dealPrice).toMatch(/two decimals/);
    expect(validateDeal(input({ targetUnits: 200 }), []).errors.targetUnits).toMatch(/more than the stock/);
    expect(validateDeal(input({ endsAt: at(1) }), []).errors.endsAt).toMatch(/end after it starts/);
  });

  it('blocks saving below the margin floor and shows the margin on the price field', () => {
    const v = validateDeal(input({ dealPrice: 32 }), []);
    expect(v.ok).toBe(false);
    expect(v.guard.blocked).toBe(true);
    expect(v.errors.dealPrice).toBe('Margin 6.3% is below the 8% floor. Raise the price, lower the cost, or flag it as a loss leader.');
  });

  it('asks a loss leader for its reason', () => {
    const v = validateDeal(input({ dealPrice: 25, lossLeader: true, lossReason: 'short' }), []);
    expect(v.errors.lossReason).toMatch(/at least 20 characters \(now 5\)/);
    expect(validateDeal(input({ dealPrice: 25, lossLeader: true, lossReason: 'Brings shoppers to the lighting aisle' }), []).ok).toBe(true);
  });

  it('refuses an overlapping deal on the same SKU, whatever the case or spacing', () => {
    expect(normaliseSku(' hm sg 001 ')).toBe('HM-SG-001');
    const v = validateDeal(input({ sku: 'HM SG 001' }), [existing()]);
    expect(v.overlap?.id).toBe('e1');
    expect(v.errors.sku).toMatch(/already has a deal in that window: Earlier lamp deal/);
  });

  it('allows back-to-back windows, other SKUs, cancelled deals and editing itself', () => {
    expect(overlaps(at(1), at(8), at(8), at(12))).toBe(false);
    expect(findOverlap(input({ endsAt: at(8) }), [existing()])).toBeNull();
    expect(findOverlap(input({ sku: 'OTHER' }), [existing()])).toBeNull();
    expect(findOverlap(input(), [existing({ status: 'cancelled' })])).toBeNull();
    expect(findOverlap(input(), [existing()], 'e1')).toBeNull();
  });
});
