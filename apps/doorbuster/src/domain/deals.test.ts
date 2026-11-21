import { FIXED_NOW, testStore } from '@x10/shared/test';

import { personas } from '../app.config';
import { defs } from '../model';
import { seed } from '../seed';
import { addNote, cancelDeal, decide, deleteDraft, importReceipts, loadWorld, saveDeal, setRole, simulateSales } from './deals';
import { buildDesk } from './desk';
import { parseReceipts } from './receipts';
import { actorFor, type Actor } from './roles';
import type { DealInput } from './validate';

const H = 3_600_000;
const now = FIXED_NOW;
const at = (h: number) => new Date(now.getTime() + h * H).toISOString();

async function setup() {
  const store = await testStore(defs, { personas, fn: seed, now });
  const world = await loadWorld(store);
  const actor = (i: number): Actor => actorFor(world.people[i], world.people, world.roles);
  const view = async (name: string, t = now.getTime()) => buildDesk(await loadWorld(store), t).views.find((v) => v.deal.name === name)!;
  return { store, world, actor, view, alex: actor(0), sam: actor(1), priya: actor(2), jordan: actor(3), chen: actor(4) };
}

const input = (over: Partial<DealInput> = {}): DealInput => ({
  name: 'Snow globe lamp',
  sku: 'HM-SG-001',
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

describe('roles', () => {
  it('maps personas to desk roles, trusting only admin-granted rows', async () => {
    const { store, world, alex, sam, jordan, chen } = await setup();
    expect(alex).toMatchObject({ isAdmin: true, canMerch: true, canApprove: true });
    expect(sam).toMatchObject({ canMerch: true, canApprove: false });
    expect(jordan).toMatchObject({ canMerch: false, canApprove: true });
    expect(chen).toMatchObject({ canMerch: false, canApprove: false });
    // Chen grants himself approver through the API: ignored.
    await store.repo('DeskRole').create({ personSub: chen.sub, personName: 'Chen', role: 'approver', grantedBy: chen.sub, grantedAt: at(0) });
    const w = await loadWorld(store);
    expect(actorFor(world.people[4], w.people, w.roles).canApprove).toBe(false);
  });

  it('lets only admins change roles', async () => {
    const { store, world, alex, sam } = await setup();
    await expect(setRole(store, sam, world.people[4], 'merchandiser', true)).rejects.toThrow(/Only admins/);
    await setRole(store, alex, world.people[4], 'merchandiser', true);
    let w = await loadWorld(store);
    expect(actorFor(world.people[4], w.people, w.roles).canMerch).toBe(true);
    await setRole(store, alex, world.people[4], 'merchandiser', true);
    w = await loadWorld(store);
    expect(w.roles.filter((r) => r.personSub === world.people[4].sub)).toHaveLength(1);
    await setRole(store, alex, world.people[4], 'merchandiser', false);
    w = await loadWorld(store);
    expect(actorFor(world.people[4], w.people, w.roles).canMerch).toBe(false);
  });
});

describe('shopfront', () => {
  it('saves a light discount as scheduled and a deep one as pending', async () => {
    const { store, sam, view } = await setup();
    const light = await saveDeal(store, sam, input(), { submit: true }, now);
    expect(light).toMatchObject({ status: 'approved', ownerSub: sam.sub, sku: 'HM-SG-001' });
    expect((await view('Snow globe lamp')).status).toBe('approved');
    const deep = await saveDeal(store, sam, input({ name: 'Deep lamp', sku: 'HM-SG-002', dealPrice: 45 }), { submit: true }, now);
    expect(deep.status).toBe('pending');
    expect((await view('Deep lamp')).status).toBe('pending');
  });

  it('blocks a save below the margin floor with the computed margin', async () => {
    const { store, sam } = await setup();
    await expect(saveDeal(store, sam, input({ dealPrice: 32 }), { submit: false }, now)).rejects.toThrow('Margin 6.3% is below the 8% floor');
  });

  it('refuses an overlapping window on the same SKU', async () => {
    const { store, sam } = await setup();
    await expect(saveDeal(store, sam, input({ sku: 'EL-TV55-AUR' }), { submit: true }, now)).rejects.toThrow(/already has a deal in that window/);
  });

  it('lets only merchandisers create, and only the owner edit or cancel', async () => {
    const { store, world, jordan, priya, sam } = await setup();
    await expect(saveDeal(store, jordan, input(), { submit: true }, now)).rejects.toThrow(/Only merchandisers/);
    const tv = world.deals.find((d) => d.sku === 'EL-TV55-AUR')!;
    await expect(saveDeal(store, priya, input({ sku: 'EL-TV55-AUR' }), { id: tv.id, submit: true }, now)).rejects.toThrow(/Only the owner, Sam Taylor/);
    await expect(cancelDeal(store, priya, tv.id, now)).rejects.toThrow(/Only the owner/);
    const draft = world.deals.find((d) => d.sku === 'TY-RC-CMT')!;
    await expect(deleteDraft(store, priya, draft.id)).rejects.toThrow(/Only the owner/);
    await expect(deleteDraft(store, sam, tv.id)).rejects.toThrow(/Only drafts/);
    await deleteDraft(store, sam, draft.id);
    expect(await store.repo('Deal').get(draft.id)).toBeNull();
  });

  it('sends an approved deep discount back to the rope when its price changes, but not for a rename', async () => {
    const { store, world, priya, view } = await setup();
    const earbuds = world.deals.find((d) => d.sku === 'EL-EB-PUL')!;
    const base: DealInput = { ...earbuds, lossReason: earbuds.lossReason ?? '' };
    await saveDeal(store, priya, { ...base, name: 'Pulse earbuds, black' }, { id: earbuds.id, submit: true }, now);
    expect((await view('Pulse earbuds, black')).status).toBe('live');
    await saveDeal(store, priya, { ...base, name: 'Pulse earbuds, black', dealPrice: 75 }, { id: earbuds.id, submit: true }, now);
    expect((await view('Pulse earbuds, black')).status).toBe('pending');
  });
});

describe('velvet rope', () => {
  it('a deep discount goes to pending and its owner cannot approve it', async () => {
    const { store, alex, jordan, view, world } = await setup();
    const coat = world.deals.find((d) => d.sku === 'FA-OC-HRB')!;
    expect(coat.ownerSub).toBe(alex.sub);
    await expect(decide(store, alex, coat.id, 'approved', '', now)).rejects.toThrow('You own this deal. Another approver has to approve it.');
    expect((await view('Harbour wool overcoat')).status).toBe('pending');
    await decide(store, jordan, coat.id, 'approved', '', now);
    const v = await view('Harbour wool overcoat');
    expect(v.status).toBe('approved');
    expect(v.approval?.approverName).toBe('Jordan Lee');
  });

  it('lets an admin approve someone else’s deal; merchandisers cannot approve', async () => {
    const { store, alex, priya, view, world } = await setup();
    const pot = world.deals.find((d) => d.sku === 'HM-CI-EMB')!;
    await expect(decide(store, priya, pot.id, 'approved', '', now)).rejects.toThrow(/Only approvers/);
    await decide(store, alex, pot.id, 'approved', 'Fine for one day.', now);
    expect((await view('Ember cast-iron casserole')).status).toBe('approved');
    await expect(decide(store, alex, pot.id, 'approved', '', now)).rejects.toThrow(/not waiting for approval/);
  });

  it('a send-back needs a note and returns the deal to draft', async () => {
    const { store, jordan, view, world } = await setup();
    const pot = world.deals.find((d) => d.sku === 'HM-CI-EMB')!;
    await expect(decide(store, jordan, pot.id, 'sent_back', 'no', now)).rejects.toThrow(/at least 10 characters/);
    await decide(store, jordan, pot.id, 'sent_back', 'Keep it at 40% off, the brand will not fund more.', now);
    const v = await view('Ember cast-iron casserole');
    expect(v.status).toBe('draft');
    expect(v.label).toBe('Sent back');
  });

  it('a forged approval row (owner writes a fake dealOwnerSub) does not count', async () => {
    const { store, alex, view, world } = await setup();
    const coat = world.deals.find((d) => d.sku === 'FA-OC-HRB')!;
    await store.repo('Approval').create({
      dealId: coat.id,
      dealOwnerSub: 'someone-else',
      approverSub: alex.sub,
      approverName: 'Alex',
      decision: 'approved',
      termsKey: '1|2|3|-',
      note: null,
      decidedAt: now.toISOString(),
    });
    expect((await view('Harbour wool overcoat')).status).toBe('pending');
  });
});

describe('notes, receipts, simulator', () => {
  it('adds a note with the entity limits', async () => {
    const { store, sam, world } = await setup();
    await expect(addNote(store, sam, world.deals[0].id, '', now)).rejects.toThrow(/required/);
    await expect(addNote(store, sam, world.deals[0].id, 'x'.repeat(401), now)).rejects.toThrow(/400 characters/);
    expect((await addNote(store, sam, world.deals[0].id, 'Restock arrives at noon.', now)).authorSub).toBe(sam.sub);
  });

  it('imports the good receipt rows and skips the unknown SKU', async () => {
    const { store, sam, world, view } = await setup();
    const before = (await view('Loft robot vacuum')).sold;
    const csv = ['sku,at,units,revenue', `HM-RV-LFT,${at(-0.2)},5,1245.00`, `ZZ-UNKNOWN,${at(-0.2)},2,10`].join('\n');
    const p = parseReceipts(csv, world.deals, world.ticks, now);
    expect(p.ok).toBe(1);
    expect(await importReceipts(store, sam, p.rows)).toBe(1);
    expect((await view('Loft robot vacuum')).sold).toBe(before + 5);
    await expect(importReceipts(store, actorFor(world.people[4], world.people, world.roles), p.rows)).rejects.toThrow(/Only merchandisers/);
  });

  it('the simulator adds sales to live deals only, never past stock', async () => {
    const { store, sam } = await setup();
    const added = await simulateSales(store, sam, new Date(now.getTime() + 60_000), 600);
    expect(added).toBeGreaterThan(0);
    const desk = buildDesk(await loadWorld(store), now.getTime() + 60_000);
    for (const v of desk.views) expect(v.sold, v.deal.name).toBeLessThanOrEqual(v.deal.stockUnits);
    expect(desk.views.find((v) => v.deal.sku === 'EL-EB-PUL')!.soldOut).toBe(true);
    expect(desk.views.find((v) => v.deal.sku === 'HM-CI-EMB')!.sold).toBe(0);
  });
});
