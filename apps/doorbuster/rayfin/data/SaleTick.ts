import { date, decimal, entity, int, role, set, text, uuid } from '@microsoft/rayfin-core';

/**
 * Units sold for one deal in one interval, appended by the Receipts import or the till simulator.
 * Security: everyone reads; create only stamped with your own sub (importedBy = caller); no update, no delete, so
 * the sales history the forecast reads from is append-only.
 */
@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', {
  policy: (claims, item) => claims.sub.eq(item.importedBy),
})
export class SaleTick {
  @uuid() id!: string;
  @uuid() dealId!: string;
  @text({ min: 2, max: 30 }) sku!: string;
  @date() at!: Date;
  @int() units!: number;
  @decimal() revenue!: number;
  @set('seed', 'import', 'simulator') source!: 'seed' | 'import' | 'simulator';
  @text({ min: 1, max: 255 }) importedBy!: string;
}
