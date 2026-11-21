import type { Deal } from '../model';
import { parseMoney, parseReceipts, parseWhen, receiptTemplate } from './receipts';

const H = 3_600_000;
const NOW = new Date('2026-11-30T10:00:00Z');
const at = (h: number) => new Date(NOW.getTime() + h * H).toISOString();

const deal = (over: Partial<Deal>): Deal => ({
  id: 'd1',
  name: 'Pulse wireless earbuds',
  sku: 'EL-EB-PUL',
  category: 'electronics',
  listPrice: 149,
  unitCost: 38,
  dealPrice: 79,
  stockUnits: 380,
  targetUnits: 300,
  startsAt: at(-8),
  endsAt: at(14),
  status: 'approved',
  lossLeader: false,
  lossReason: null,
  ownerSub: 'p',
  ownerName: 'P',
  submittedAt: at(-30),
  createdAt: at(-40),
  updatedAt: at(-30),
  ...over,
});

const deals = [
  deal({}),
  deal({ id: 'd2', name: 'Puzzle cube', sku: 'TY-PZ-PKT', startsAt: at(-10), endsAt: at(-4) }),
  deal({ id: 'd3', name: 'Comet RC racer', sku: 'TY-RC-CMT', status: 'draft' }),
];

describe('receipts import', () => {
  it('imports good rows and shows a row error for an unknown SKU', () => {
    const csv = ['sku,at,units,revenue', 'EL-EB-PUL,2026-11-30T09:15:00Z,4,316.00', 'XX-NOPE,2026-11-30T09:15:00Z,2,40', 'el-eb-pul,2026-11-30T09:30:00Z,3,"$237.00"'].join('\n');
    const r = parseReceipts(csv, deals, [], NOW);
    expect(r.fileError).toBeNull();
    expect(r.ok).toBe(2);
    expect(r.bad).toBe(1);
    expect(r.rows[1]).toMatchObject({ line: 3, error: 'Unknown SKU XX-NOPE: no deal sells it.' });
    expect(r.rows[2]).toMatchObject({ sku: 'EL-EB-PUL', dealId: 'd1', revenue: 237, error: null });
  });

  it('accepts the columns in any order and checks each value', () => {
    const csv = [
      'units,revenue,sku,at',
      'x,10,EL-EB-PUL,2026-11-30T09:00',
      '2,-1,EL-EB-PUL,2026-11-30T09:00',
      '2,10,EL-EB-PUL,30/11/2026 09:00',
      '2,10,EL-EB-PUL,2026-11-30T23:00Z',
      '99999,10,EL-EB-PUL,2026-11-30T09:00Z',
    ].join('\n');
    const errs = parseReceipts(csv, deals, [], NOW).rows.map((r) => r.error);
    expect(errs[0]).toMatch(/whole number of 1 or more/);
    expect(errs[1]).toMatch(/Revenue must be a number/);
    expect(errs[2]).toMatch(/is not a date and time/);
    expect(errs[3]).toBe('The time is in the future.');
    expect(errs[4]).toMatch(/more than 10,000/);
  });

  it('matches a sale to the deal window running at that time', () => {
    const csv = ['sku,at,units,revenue', 'TY-PZ-PKT,2026-11-30T03:00:00Z,5,60', 'TY-PZ-PKT,2026-11-30T08:00:00Z,5,60', 'TY-RC-CMT,2026-11-30T08:00:00Z,5,60'].join('\n');
    const r = parseReceipts(csv, deals, [], NOW);
    expect(r.rows[0].dealId).toBe('d2');
    expect(r.rows[1].error).toBe('No TY-PZ-PKT deal was running at that time.');
    expect(r.rows[2].error).toBe('The TY-RC-CMT deal is draft; it cannot have sales.');
  });

  it('refuses sales for a deal that still waits for approval', () => {
    const csv = ['sku,at,units,revenue', 'EL-EB-PUL,2026-11-30T09:15:00Z,4,316'].join('\n');
    const r = parseReceipts(csv, deals, [], NOW, new Map([['d1', 'waits for approval']]));
    expect(r.rows[0].error).toBe('Pulse wireless earbuds waits for approval; it cannot have sales yet.');
  });

  it('skips rows already imported and duplicates within the file', () => {
    const line = 'EL-EB-PUL,2026-11-30T09:15:00Z,4,316';
    const r = parseReceipts(['sku,at,units,revenue', line, line].join('\n'), deals, [{ sku: 'EL-EB-PUL', at: '2026-11-30T09:00:00.000Z', units: 4 }], NOW);
    expect(r.rows[0].error).toBeNull();
    expect(r.rows[1].error).toMatch(/Already imported/);
    const again = parseReceipts(['sku,at,units,revenue', line].join('\n'), deals, [{ sku: 'EL-EB-PUL', at: '2026-11-30T09:15:00.000Z', units: 4 }], NOW);
    expect(again.rows[0].error).toMatch(/Already imported/);
  });

  it('refuses a file without the header or with too many rows', () => {
    expect(parseReceipts('', deals, [], NOW).fileError).toMatch(/empty/);
    expect(parseReceipts('sku,when,units\nA,B,C', deals, [], NOW).fileError).toBe('The header is missing at, revenue. Expected sku,at,units,revenue.');
    expect(parseReceipts('sku,at,units,revenue\n', deals, [], NOW).fileError).toMatch(/no rows/);
    const big = ['sku,at,units,revenue', ...Array.from({ length: 2001 }, () => 'A,B,1,1')].join('\n');
    expect(parseReceipts(big, deals, [], NOW).fileError).toMatch(/at most 2000/);
  });

  it('parses money and times', () => {
    expect(parseMoney('$1,299.50')).toBe(1299.5);
    expect(parseMoney('12 345')).toBe(12345);
    expect(parseMoney('ten')).toBeNaN();
    expect(parseWhen('2026-11-30 09:15')).not.toBeNull();
    expect(parseWhen('2026-11-30')).toBeNull();
  });

  it('writes a template with good rows and one unknown SKU', () => {
    const t = receiptTemplate(deals, NOW);
    const r = parseReceipts(t, deals, [], NOW);
    expect(r.ok).toBe(1);
    expect(r.bad).toBe(1);
  });
});
