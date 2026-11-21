import { date, entity, role, set, text, uuid } from '@microsoft/rayfin-core';

/**
 * One Velvet rope decision on a deal: approved, or sent back with a note. Append-only.
 *
 * Security: everyone reads; create only stamped with your own sub (approverSub = caller) and never on a deal you own
 * (`dealOwnerSub` is the deal's ownerSub, denormalised so the policy can name it); no update, no delete.
 * The domain counts a decision only when dealOwnerSub matches the deal, the approver holds the approver role, the
 * terms key matches the deal's current prices and the decision is newer than the deal's last submission.
 */
@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', {
  policy: (claims, item) => claims.sub.eq(item.approverSub).and(claims.sub.neq(item.dealOwnerSub)),
})
export class Approval {
  @uuid() id!: string;
  @uuid() dealId!: string;
  @text({ min: 1, max: 255 }) dealOwnerSub!: string;
  @text({ min: 1, max: 255 }) approverSub!: string;
  @text({ min: 1, max: 100 }) approverName!: string;
  @set('approved', 'sent_back') decision!: 'approved' | 'sent_back';
  @text({ min: 1, max: 120 }) termsKey!: string;
  @text({ max: 400, optional: true }) note?: string;
  @date() decidedAt!: Date;
}
