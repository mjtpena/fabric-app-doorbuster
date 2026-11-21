import { boolean, date, decimal, entity, int, role, set, text, uuid } from '@microsoft/rayfin-core';

/**
 * A time-boxed Cyber Monday deal: one shop window in the midnight arcade.
 *
 * Security (README "Security model"; keep in step with src/domain/deals.ts):
 * - read: every signed-in user.
 * - create: only as yourself (ownerSub = caller), and never straight into a time-driven status (live, ended).
 * - update: only the owner; the owner can never hand the deal to someone else (ownerSub and createdAt are frozen).
 * - delete: only the owner (the app deletes drafts only; anything submitted is cancelled instead).
 * Approval is not a column the owner can write: it is an append-only Approval row created by someone else, and the
 * effective status (approved, live, ended) is computed from that row, the clock and the sales (src/domain/status.ts).
 * A stored status of 'approved' on a deep discount without a valid approval counts as pending.
 */
@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', {
  policy: (claims, item) => claims.sub.eq(item.ownerSub).and(item.status.neq('live')).and(item.status.neq('ended')),
})
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.ownerSub),
  exclude: ['ownerSub', 'createdAt'],
})
@role('authenticated', 'delete', {
  policy: (claims, item) => claims.sub.eq(item.ownerSub),
})
export class Deal {
  @uuid() id!: string;
  @text({ min: 3, max: 80 }) name!: string;
  @text({ min: 2, max: 30 }) sku!: string;
  @set('electronics', 'home', 'fashion', 'toys', 'beauty', 'grocery')
  category!: 'electronics' | 'home' | 'fashion' | 'toys' | 'beauty' | 'grocery';
  @decimal() listPrice!: number;
  @decimal() unitCost!: number;
  @decimal() dealPrice!: number;
  @int() stockUnits!: number;
  @int() targetUnits!: number;
  @date() startsAt!: Date;
  @date() endsAt!: Date;
  @set('draft', 'pending', 'approved', 'live', 'ended', 'cancelled')
  status!: 'draft' | 'pending' | 'approved' | 'live' | 'ended' | 'cancelled';
  @boolean() lossLeader!: boolean;
  @text({ max: 300, optional: true }) lossReason?: string;
  @text({ min: 1, max: 255 }) ownerSub!: string;
  @text({ min: 1, max: 100 }) ownerName!: string;
  @date({ optional: true }) submittedAt?: Date;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
