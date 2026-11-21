import { FIXED_NOW, testStore } from '@x10/shared/test';

import { personas } from '../app.config';
import { loadWorld } from '../domain/deals';
import { buildDesk, eventDay, groupKey, isRelevant, lensColor } from '../domain/desk';
import { actorFor } from '../domain/roles';
import { defs, type Category } from '../model';
import { seed } from '../seed';
import { goodsKind } from './art';
import { hash, layoutArcade, SCENE_MIN_W, UPPER, WIN_W } from './layout';

const item = (category: Category, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${category}-${i}`, category }));

describe('arcade layout', () => {
  it('puts three categories on each floor, a window per deal, none overlapping', () => {
    const items = [...item('electronics', 3), ...item('home', 3), ...item('toys', 3), ...item('grocery', 2)];
    const l = layoutArcade(items, (i) => i.category);
    expect(l.blocks).toHaveLength(6);
    expect(l.blocks.filter((b) => b.floor === 0).map((b) => b.category)).toEqual(UPPER);
    expect(l.windows.filter((w) => w.item)).toHaveLength(11);
    // Empty categories keep one "to let" window.
    expect(l.blocks.find((b) => b.category === 'fashion')!.windows).toEqual([expect.objectContaining({ item: null })]);
    for (const f of [0, 1]) {
      const row = l.windows.filter((w) => w.floor === f).sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) expect(row[i].x).toBeGreaterThanOrEqual(row[i - 1].x + WIN_W);
      for (const w of row) expect(w.x).toBeGreaterThanOrEqual(0);
      for (const w of row) expect(w.x + w.w).toBeLessThanOrEqual(l.width);
    }
  });

  it('widens the scene for a big event instead of shrinking windows', () => {
    const l = layoutArcade(item('electronics', 14), (i) => i.category);
    expect(l.width).toBeGreaterThan(SCENE_MIN_W);
    expect(l.windows.every((w) => w.w === WIN_W)).toBe(true);
  });

  it('draws the same goods for the same deal every time', () => {
    expect(goodsKind('Pulse wireless earbuds', 'electronics', 'EL-EB-PUL')).toBe('earbuds');
    expect(goodsKind('Mystery gadget', 'electronics', 'X-1')).toBe(goodsKind('Mystery gadget', 'electronics', 'X-1'));
    expect(hash('abc')).toBe(hash('abc'));
    expect(hash('abc')).not.toBe(hash('abd'));
  });
});

describe('desk lenses and view as', () => {
  it('colours windows by lens and steps back what a role does not act on', async () => {
    const store = await testStore(defs, { personas, fn: seed, now: FIXED_NOW });
    const world = await loadWorld(store);
    const desk = buildDesk(world, FIXED_NOW.getTime());
    const v = (sku: string) => desk.views.find((x) => x.deal.sku === sku)!;
    expect(groupKey(v('TY-RC-CMT'), 'margin')).toBe('below');
    expect(groupKey(v('HM-CI-EMB'), 'discount')).toBe('deep');
    expect(lensColor(v('EL-EB-PUL'), 'risk')).toBe('var(--db-neon-warn)');
    expect(lensColor(v('EL-TV55-AUR'), 'risk')).toBe('var(--db-neon-bad)');
    const alex = actorFor(world.people[0], world.people, world.roles);
    const priya = actorFor(world.people[2], world.people, world.roles);
    expect(isRelevant(v('HM-CI-EMB'), 'approver', alex, desk.views)).toBe(true);
    expect(isRelevant(v('HM-RV-LFT'), 'approver', alex, desk.views)).toBe(false);
    expect(isRelevant(v('EL-EB-PUL'), 'merchandiser', priya, desk.views)).toBe(true);
    expect(isRelevant(v('EL-TV55-AUR'), 'merchandiser', priya, desk.views)).toBe(false);
  });

  it('spans the clock over the event day, always containing now', () => {
    const now = FIXED_NOW.getTime();
    const day = eventDay([], now);
    expect(day.to - day.from).toBe(24 * 3_600_000);
    expect(now).toBeGreaterThanOrEqual(day.from);
    expect(now).toBeLessThanOrEqual(day.to);
  });
});
