import { date, entity, role, text, uuid } from '@microsoft/rayfin-core';

/** A note on a deal. Everyone reads; authors create, edit and delete only their own notes. */
@entity()
@role('authenticated', 'read')
@role('authenticated', ['create', 'update', 'delete'], {
  policy: (claims, item) => claims.sub.eq(item.authorSub),
})
export class DealNote {
  @uuid() id!: string;
  @uuid() dealId!: string;
  @text({ min: 1, max: 255 }) authorSub!: string;
  @text({ min: 1, max: 100 }) authorName!: string;
  @text({ min: 1, max: 400 }) body!: string;
  @date() createdAt!: Date;
}
