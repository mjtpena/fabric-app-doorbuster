import { FIXED_NOW, testStore } from '@x10/shared/test';

import { personas } from '../app.config';
import { defs } from '../model';
import { seed, SPECS } from '../seed';
import { buildDesk, todayFor } from './desk';
import { loadWorld } from './deals';
import { actorFor } from './roles';

async function deskAt(now: Date) {
  const store = await testStore(defs, { personas, fn: seed, now });
  const world = await loadWorld(store);
  return { store, world, desk: buildDesk(world, now.getTime()) };
}

const byName = (views: ReturnType<typeof buildDesk>['views'], name: string) => views.find((v) => v.deal.name === name)!;

describe('seed', () => {
  // The story must hold whatever minute the seed runs at.
  for (const offset of [0, 7, 14, 37, 59]) {
    it(`tells the same story at ${offset} min past the hour`, async () => {
      const now = new Date(FIXED_NOW.getTime() + offset * 60_000);
      const { desk } = await deskAt(now);
      const v = desk.views;
      expect(v).toHaveLength(18);
      expect(new Set(v.map((x) => x.deal.category)).size).toBe(6);
      expect(v.filter((x) => x.soldOut).map((x) => x.deal.name).sort()).toEqual(['Aurora 55" 4K TV', 'Trailhead knit beanie']);
      expect(v.filter((x) => x.status === 'live' && x.forecast.kind === 'early').map((x) => x.deal.name).sort()).toEqual([
        'Driftwood linen bedding set',
        'Pulse wireless earbuds',
      ]);
      const earbuds = byName(v, 'Pulse wireless earbuds');
      expect(earbuds.forecast.kind === 'early' && earbuds.forecast.hoursToSellOut).toBeLessThan(2);
      const bedding = byName(v, 'Driftwood linen bedding set');
      expect(bedding.forecast.kind === 'early' && bedding.forecast.hoursToSellOut).toBeGreaterThan(2);
      expect(v.filter((x) => x.status === 'pending').map((x) => x.deal.name).sort()).toEqual(['Ember cast-iron casserole', 'Harbour wool overcoat']);
      const blocked = v.filter((x) => x.status === 'draft' && x.belowFloor);
      expect(blocked.map((x) => x.deal.name)).toEqual(['Comet RC racer']);
      expect(new Set(v.map((x) => x.status))).toEqual(new Set(['draft', 'pending', 'approved', 'live', 'ended', 'cancelled']));
      expect(byName(v, 'Pocket puzzle cube')).toMatchObject({ status: 'ended', soldOut: false });
      expect(byName(v, 'Velour hair dryer').status).toBe('approved');
      expect(byName(v, 'Organic olive oil, 1 L')).toMatchObject({ status: 'live', belowFloor: true });
      // Everyone else lasts to the end.
      for (const x of v.filter((y) => y.status === 'live' && !['Driftwood linen bedding set', 'Pulse wireless earbuds'].includes(y.deal.name)))
        expect(x.forecast.kind, x.deal.name).toBe('lasts');
    });
  }

  it('Today for the admin ranks the sell-out, the velvet rope, the margin floor and the top seller', async () => {
    const { world, desk } = await deskAt(FIXED_NOW);
    const me = world.people[0];
    const items = todayFor(desk, 'all', actorFor(me, world.people, world.roles));
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(items[0].title).toMatch(/Pulse wireless earbuds sells out around/);
    expect(items.map((i) => i.id)).toContain('pending');
    expect(items.find((i) => i.id.startsWith('floor-'))?.title).toMatch(/Comet RC racer is below the 8% margin floor/);
    expect(items.find((i) => i.id.startsWith('top-'))?.title).toBe('Top seller: Aurora 55" 4K TV');
  });

  it('has one spec per deal and unique SKUs', () => {
    expect(new Set(SPECS.map((s) => s.sku)).size).toBe(SPECS.length);
  });
});
