/**
 * Deal-desk actions through the DataStore. Every permission and rule is checked here, so it holds in demo mode and in
 * Fabric alike; row policies close what the database can express (see rayfin/data/*.ts).
 */
import { PermissionError, RuleError, type DataStore } from '@x10/shared/data';
import type { Person } from '@x10/shared/identity';
import { checkText, toMs } from '@x10/shared/lib';

import { rules } from '../config';
import { limits, type Approval, type Deal, type DealNote, type DeskRole, type DeskRoleName, type SaleTick, type Schema } from '../model';
import { buildDesk, type World } from './desk';
import { salesRate } from './forecast';
import { requiresApproval, termsKey } from './pricing';
import type { ReceiptRow } from './receipts';
import type { Actor } from './roles';
import { normaliseSku, validateDeal, type DealInput } from './validate';

type Store = DataStore<Schema>;

export async function loadWorld(store: Store): Promise<World> {
  const [deals, ticks, notes, approvals, roles, people] = await Promise.all([
    store.repo('Deal').list({ limit: 5000 }),
    store.repo('SaleTick').list({ limit: 50000 }),
    store.repo('DealNote').list({ limit: 5000 }),
    store.repo('Approval').list({ limit: 5000 }),
    store.repo('DeskRole').list({ limit: 1000 }),
    store.repo('Person').list({ limit: 1000 }),
  ]);
  return { deals, ticks, notes, approvals, roles, people };
}

function firstError(errors: Record<string, string | undefined>): string {
  return Object.values(errors).find(Boolean) ?? 'Check the form.';
}

/**
 * Create or edit a deal. `submit` false keeps it a draft; true sends a deep discount or loss leader to the velvet
 * rope (pending) and schedules anything else (approved). The margin guard and the SKU overlap rule block both.
 */
export async function saveDeal(
  store: Store,
  actor: Actor,
  input: DealInput,
  opts: { id?: string; submit: boolean },
  now = new Date(),
): Promise<Deal> {
  if (!actor.canMerch) throw new PermissionError('Only merchandisers can create or edit deals.');
  const repo = store.repo('Deal');
  const deals = await repo.list({ limit: 5000 });
  const existing = opts.id ? deals.find((d) => d.id === opts.id) : undefined;
  if (opts.id && !existing) throw new RuleError('That deal no longer exists.');
  if (existing) {
    if (existing.ownerSub !== actor.sub) throw new PermissionError(`Only the owner, ${existing.ownerName}, can edit this deal.`);
    if (existing.status === 'cancelled') throw new RuleError('This deal was cancelled; create a new one instead.');
    if (toMs(existing.endsAt) <= now.getTime()) throw new RuleError('This deal has ended and can no longer be edited.');
  }
  const v = validateDeal(input, deals, existing?.id);
  if (!v.ok) throw new RuleError(firstError(v.errors));

  const terms = {
    listPrice: input.listPrice,
    unitCost: input.unitCost,
    dealPrice: input.dealPrice,
    lossLeader: input.lossLeader,
  };
  const status: Deal['status'] = opts.submit ? (requiresApproval(terms) ? 'pending' : 'approved') : 'draft';
  const sameTerms = existing && existing.status !== 'draft' && termsKey(existing) === termsKey(terms);
  const submittedAt = opts.submit ? (sameTerms && existing?.submittedAt ? existing.submittedAt : now.toISOString()) : (existing?.submittedAt ?? null);
  const data = {
    name: input.name.trim(),
    sku: normaliseSku(input.sku),
    category: input.category,
    listPrice: input.listPrice,
    unitCost: input.unitCost,
    dealPrice: input.dealPrice,
    stockUnits: input.stockUnits,
    targetUnits: input.targetUnits,
    startsAt: input.startsAt!,
    endsAt: input.endsAt!,
    status,
    lossLeader: input.lossLeader,
    lossReason: input.lossLeader ? input.lossReason.trim() : null,
    submittedAt,
    updatedAt: now.toISOString(),
  };
  if (existing) return repo.update(existing.id, data);
  return repo.create({ ...data, ownerSub: actor.sub, ownerName: actor.name.slice(0, limits.ownerName.max), createdAt: now.toISOString() });
}

/** Cancel a submitted deal (drafts are deleted instead). Only the owner. */
export async function cancelDeal(store: Store, actor: Actor, id: string, now = new Date()): Promise<Deal> {
  const deal = await store.repo('Deal').get(id);
  if (!deal) throw new RuleError('That deal no longer exists.');
  if (deal.ownerSub !== actor.sub) throw new PermissionError(`Only the owner, ${deal.ownerName}, can cancel this deal.`);
  if (deal.status === 'cancelled') throw new RuleError('This deal is already cancelled.');
  if (toMs(deal.endsAt) <= now.getTime()) throw new RuleError('This deal has already ended.');
  return store.repo('Deal').update(id, { status: 'cancelled', updatedAt: now.toISOString() });
}

export async function deleteDraft(store: Store, actor: Actor, id: string): Promise<void> {
  const deal = await store.repo('Deal').get(id);
  if (!deal) return;
  if (deal.ownerSub !== actor.sub) throw new PermissionError(`Only the owner, ${deal.ownerName}, can delete this draft.`);
  if (deal.status !== 'draft') throw new RuleError('Only drafts can be deleted; cancel a submitted deal instead.');
  const ticks = await store.repo('SaleTick').list({ where: { dealId: id }, limit: 1 });
  if (ticks.length) throw new RuleError('This deal has sales and cannot be deleted.');
  await store.repo('Deal').remove(id);
}

/**
 * A Velvet rope decision. The approver must hold the approver role, must not own the deal, and the deal must be
 * waiting. Sending back needs a note. The decision is an append-only Approval row bound to the deal's exact terms.
 */
export async function decide(
  store: Store,
  actor: Actor,
  dealId: string,
  decision: Approval['decision'],
  note: string,
  now = new Date(),
): Promise<Approval> {
  if (!actor.canApprove) throw new PermissionError('Only approvers can decide at the velvet rope.');
  const world = await loadWorld(store);
  const deal = world.deals.find((d) => d.id === dealId);
  if (!deal) throw new RuleError('That deal no longer exists.');
  if (deal.ownerSub === actor.sub) throw new PermissionError('You own this deal. Another approver has to approve it.');
  const view = buildDesk(world, now.getTime()).views.find((x) => x.deal.id === dealId)!;
  if (view.status !== 'pending') throw new RuleError(`This deal is not waiting for approval (it is ${view.label.toLowerCase()}).`);
  const body = note.trim();
  if (decision === 'sent_back' && body.length < rules.SEND_BACK_MIN)
    throw new RuleError(`Say why it goes back, in at least ${rules.SEND_BACK_MIN} characters.`);
  const msg = checkText(body, { ...limits.approvalNote, optional: true, label: 'Note' });
  if (msg) throw new RuleError(msg);
  return store.repo('Approval').create({
    dealId,
    dealOwnerSub: deal.ownerSub,
    approverSub: actor.sub,
    approverName: actor.name.slice(0, limits.personName.max),
    decision,
    termsKey: termsKey(deal),
    note: body || null,
    decidedAt: now.toISOString(),
  });
}

export async function addNote(store: Store, actor: Actor, dealId: string, body: string, now = new Date()): Promise<DealNote> {
  const msg = checkText(body, { ...limits.noteBody, label: 'Note' });
  if (msg) throw new RuleError(msg);
  return store.repo('DealNote').create({
    dealId,
    authorSub: actor.sub,
    authorName: actor.name.slice(0, limits.personName.max),
    body: body.trim(),
    createdAt: now.toISOString(),
  });
}

export async function deleteNote(store: Store, actor: Actor, note: DealNote): Promise<void> {
  if (note.authorSub !== actor.sub) throw new PermissionError('You can delete only your own notes.');
  await store.repo('DealNote').remove(note.id);
}

/** Append the good rows of a Receipts preview as sales ticks. Rows with errors are skipped. */
export async function importReceipts(store: Store, actor: Actor, rows: ReceiptRow[]): Promise<number> {
  if (!actor.canMerch) throw new PermissionError('Only merchandisers can import receipts.');
  const good = rows.filter((r) => !r.error && r.dealId && r.at);
  for (const r of good) {
    await store.repo('SaleTick').create({
      dealId: r.dealId!,
      sku: r.sku,
      at: r.at!,
      units: r.units,
      revenue: Math.round(r.revenue * 100) / 100,
      source: 'import',
      importedBy: actor.sub,
    });
  }
  return good.length;
}

/** Deterministic jitter in [0.75, 1.25) from a string, so a simulated rush is repeatable. */
function jitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return 0.75 + ((h >>> 0) % 1000) / 2000;
}

/**
 * The till simulator: one tick per live deal at `now`, worth `minutes` of selling at the deal's recent rate (or its
 * planned pace when it has none), never more than the stock left. Returns the units added.
 */
export async function simulateSales(store: Store, actor: Actor, now = new Date(), minutes = 10): Promise<number> {
  if (!actor.canMerch) throw new PermissionError('Only merchandisers can run the till simulator.');
  const world = await loadWorld(store);
  const desk = buildDesk(world, now.getTime());
  let added = 0;
  for (const v of desk.views) {
    if (v.status !== 'live') continue;
    const r = salesRate(v.ticks, v.deal.startsAt, now.getTime());
    const planned = v.deal.targetUnits / Math.max(1, (toMs(v.deal.endsAt) - toMs(v.deal.startsAt)) / 3_600_000);
    const rate = r && r.rate > 0 ? r.rate : planned;
    const left = v.deal.stockUnits - v.sold;
    const units = Math.min(left, Math.max(1, Math.round((rate * minutes * jitter(`${v.deal.id}${now.getTime()}`)) / 60)));
    if (units <= 0) continue;
    await store.repo('SaleTick').create({
      dealId: v.deal.id,
      sku: v.deal.sku,
      at: now.toISOString(),
      units,
      revenue: Math.round(units * v.deal.dealPrice * 100) / 100,
      source: 'simulator',
      importedBy: actor.sub,
    } satisfies Omit<SaleTick, 'id'>);
    added += units;
  }
  return added;
}

/** Admins grant and revoke desk roles. A person holds each role at most once. */
export async function setRole(store: Store, actor: Actor, person: Person, role: DeskRoleName, on: boolean, now = new Date()): Promise<void> {
  if (!actor.isAdmin) throw new PermissionError('Only admins can change desk roles.');
  const repo = store.repo('DeskRole');
  const rows = (await repo.list({ where: { personSub: person.sub }, limit: 50 })).filter((r) => r.role === role);
  if (on && rows.length === 0) {
    await repo.create({ personSub: person.sub, personName: person.displayName, role, grantedBy: actor.sub, grantedAt: now.toISOString() } satisfies Omit<DeskRole, 'id'>);
  }
  if (!on) {
    const mine = rows.filter((r) => r.grantedBy === actor.sub);
    if (mine.length < rows.length) throw new RuleError('Another admin granted this role; they have to remove it.');
    for (const r of mine) await repo.remove(r.id);
  }
}
