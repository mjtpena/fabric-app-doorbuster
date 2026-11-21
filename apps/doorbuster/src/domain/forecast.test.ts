import { crowdSize, cumulativeSeries, forecast, lastHourUnits, salesRate, soldBy, soldOutAt } from './forecast';

const H = 3_600_000;
const T0 = Date.parse('2026-11-30T00:00:00Z');
const at = (h: number) => new Date(T0 + h * H).toISOString();
const tick = (h: number, units: number) => ({ at: at(h), units, revenue: units * 10 });
const window = (stock: number, endH = 24, startH = 0, target = stock) => ({ startsAt: at(startH), endsAt: at(endH), stockUnits: stock, targetUnits: target });

/** Ticks every 15 minutes from start to end at `rate` units an hour. */
function steady(rate: number, fromH: number, toH: number) {
  const out = [];
  for (let h = fromH + 0.25; h <= toH + 1e-9; h += 0.25) out.push(tick(h, rate / 4));
  return out;
}

describe('sales maths', () => {
  it('counts units up to a time, and in an interval', () => {
    const ticks = [tick(1, 5), tick(2, 7), tick(3, 9)];
    expect(soldBy(ticks, T0 + 2 * H)).toBe(12);
    expect(lastHourUnits(ticks, T0 + 3 * H)).toBe(9);
  });

  it('finds the tick that sold the last unit, unsorted input included', () => {
    expect(soldOutAt([tick(3, 5), tick(1, 5), tick(2, 5)], 10)).toBe(at(2));
    expect(soldOutAt([tick(1, 5)], 10)).toBeNull();
    expect(soldOutAt([tick(1, 5)], 0)).toBeNull();
  });

  it('uses the last two hours, or the time since the start when shorter', () => {
    const ticks = steady(20, 0, 5);
    expect(salesRate(ticks, at(0), T0 + 5 * H)!.rate).toBeCloseTo(20);
    expect(salesRate(ticks, at(4), T0 + 5 * H)!.hours).toBeCloseTo(1);
    // Ten minutes in is too early to project.
    expect(salesRate(ticks, at(4.9), T0 + 5 * H)).toBeNull();
  });

  it('sizes the queue by sales in the last hour, capped', () => {
    expect(crowdSize(0)).toBe(0);
    expect(crowdSize(2)).toBe(1);
    expect(crowdSize(24)).toBe(3);
    expect(crowdSize(10_000)).toBe(7);
  });

  it('builds a cumulative series in buckets', () => {
    const s = cumulativeSeries([tick(0.5, 2), tick(1.5, 3)], T0, T0 + 2 * H, H);
    expect(s.map((p) => p.sold)).toEqual([2, 5]);
    expect(s.map((p) => p.units)).toEqual([2, 3]);
  });
});

describe('sell-out forecast', () => {
  it('projects the sell-out time and warns when it is before the end', () => {
    const f = forecast(window(100, 24), steady(20, 0, 2), T0 + 2 * H);
    expect(f.kind).toBe('early');
    if (f.kind !== 'early') return;
    expect(f.remaining).toBe(60);
    expect(f.hoursToSellOut).toBeCloseTo(3);
    expect(f.at).toBe(at(5));
    expect(f.hoursEarly).toBeCloseTo(19);
  });

  it('says it lasts when the projection is after the end, with units sold by the end', () => {
    const f = forecast(window(1000, 10, 0, 300), steady(20, 0, 4), T0 + 4 * H);
    expect(f.kind).toBe('lasts');
    if (f.kind !== 'lasts') return;
    expect(f.projectedUnits).toBe(200);
  });

  it('is sold out once cumulative sales reach stock (the window ends early)', () => {
    const f = forecast(window(40, 24), steady(20, 0, 3), T0 + 3 * H);
    expect(f).toEqual({ kind: 'soldOut', at: at(2), early: true });
  });

  it('ignores ticks after "now" (replaying the day)', () => {
    const ticks = steady(20, 0, 6);
    expect(forecast(window(100, 24), ticks, T0 + 1 * H).kind).toBe('early');
    expect(soldBy(ticks, T0 + 1 * H)).toBe(20);
  });

  it('has no projection before the start, after the end, too early or with no recent sales', () => {
    expect(forecast(window(100, 24, 5), [], T0 + 1 * H).kind).toBe('notStarted');
    expect(forecast(window(100, 2), steady(5, 0, 2), T0 + 3 * H).kind).toBe('ended');
    expect(forecast(window(100, 24, 1), [], T0 + 1.1 * H).kind).toBe('tooEarly');
    expect(forecast(window(100, 24), [tick(0.5, 3)], T0 + 4 * H)).toEqual({ kind: 'stalled', remaining: 97 });
  });

  it('caps the projection at stock when imports oversell', () => {
    const f = forecast(window(10, 24), [tick(1, 25)], T0 + 2 * H);
    expect(f.kind).toBe('soldOut');
  });
});
