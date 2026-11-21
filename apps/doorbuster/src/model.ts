/**
 * App data types and runtime entity definitions. Keep these in step with rayfin/data/*.ts:
 * every field listed here must exist on the entity class with the matching decorator.
 * Dates are ISO strings in the app; optional fields are `| null`.
 */
import type { EntityDefs } from '@x10/shared/data';
import { AppMarkerDef, PersonDef, type AppMarker, type Person } from '@x10/shared/identity';

/** The same numbers as the decorators on the entities. */
export const limits = {
  dealName: { min: 3, max: 80 },
  sku: { min: 2, max: 30 },
  lossReason: { max: 300 },
  ownerName: { min: 1, max: 100 },
  noteBody: { min: 1, max: 400 },
  approvalNote: { max: 400 },
  termsKey: { min: 1, max: 120 },
  personName: { min: 1, max: 100 },
} as const;

export const CATEGORIES = ['electronics', 'home', 'fashion', 'toys', 'beauty', 'grocery'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  electronics: 'Electronics',
  home: 'Home',
  fashion: 'Fashion',
  toys: 'Toys',
  beauty: 'Beauty',
  grocery: 'Grocery',
};

export const DEAL_STATUSES = ['draft', 'pending', 'approved', 'live', 'ended', 'cancelled'] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const DECISIONS = ['approved', 'sent_back'] as const;
export type Decision = (typeof DECISIONS)[number];

export const TICK_SOURCES = ['seed', 'import', 'simulator'] as const;
export type TickSource = (typeof TICK_SOURCES)[number];

export const DESK_ROLES = ['merchandiser', 'approver'] as const;
export type DeskRoleName = (typeof DESK_ROLES)[number];

export interface Deal {
  id: string;
  name: string;
  sku: string;
  category: Category;
  listPrice: number;
  unitCost: number;
  dealPrice: number;
  stockUnits: number;
  targetUnits: number;
  startsAt: string;
  endsAt: string;
  /** The stored, owner-written status: draft, pending, approved or cancelled. Live and ended are computed. */
  status: DealStatus;
  lossLeader: boolean;
  lossReason: string | null;
  ownerSub: string;
  ownerName: string;
  /** When the owner last submitted the current terms (approvals older than this do not count). */
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaleTick {
  id: string;
  dealId: string;
  sku: string;
  at: string;
  units: number;
  revenue: number;
  source: TickSource;
  importedBy: string;
}

export interface DealNote {
  id: string;
  dealId: string;
  authorSub: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface Approval {
  id: string;
  dealId: string;
  dealOwnerSub: string;
  approverSub: string;
  approverName: string;
  decision: Decision;
  termsKey: string;
  note: string | null;
  decidedAt: string;
}

export interface DeskRole {
  id: string;
  personSub: string;
  personName: string;
  role: DeskRoleName;
  grantedBy: string;
  grantedAt: string;
}

export type Schema = {
  Person: Person;
  AppMarker: AppMarker;
  Deal: Deal;
  SaleTick: SaleTick;
  DealNote: DealNote;
  Approval: Approval;
  DeskRole: DeskRole;
};

export const defs: EntityDefs<Schema> = {
  Person: PersonDef,
  AppMarker: AppMarkerDef,
  Deal: {
    name: 'Deal',
    fields: {
      id: 'uuid',
      name: 'text',
      sku: 'text',
      category: 'set',
      listPrice: 'decimal',
      unitCost: 'decimal',
      dealPrice: 'decimal',
      stockUnits: 'int',
      targetUnits: 'int',
      startsAt: 'date',
      endsAt: 'date',
      status: 'set',
      lossLeader: 'bool',
      lossReason: 'text',
      ownerSub: 'text',
      ownerName: 'text',
      submittedAt: 'date',
      createdAt: 'date',
      updatedAt: 'date',
    },
  },
  SaleTick: {
    name: 'SaleTick',
    fields: { id: 'uuid', dealId: 'uuid', sku: 'text', at: 'date', units: 'int', revenue: 'decimal', source: 'set', importedBy: 'text' },
  },
  DealNote: {
    name: 'DealNote',
    fields: { id: 'uuid', dealId: 'uuid', authorSub: 'text', authorName: 'text', body: 'text', createdAt: 'date' },
  },
  Approval: {
    name: 'Approval',
    fields: {
      id: 'uuid',
      dealId: 'uuid',
      dealOwnerSub: 'text',
      approverSub: 'text',
      approverName: 'text',
      decision: 'set',
      termsKey: 'text',
      note: 'text',
      decidedAt: 'date',
    },
  },
  DeskRole: {
    name: 'DeskRole',
    fields: { id: 'uuid', personSub: 'text', personName: 'text', role: 'set', grantedBy: 'text', grantedAt: 'date' },
  },
};
