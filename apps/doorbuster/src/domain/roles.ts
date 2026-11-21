/**
 * Who may do what on the deal desk. Admins (Person.isAdmin) are merchandisers and approvers. Others get a role from a
 * DeskRole row, which counts only when an admin granted it. Everyone else is a viewer.
 */
import type { Person } from '@x10/shared/identity';

import type { DeskRole, DeskRoleName } from '../model';

export interface Actor {
  sub: string;
  name: string;
  isAdmin: boolean;
  canMerch: boolean;
  canApprove: boolean;
}

export function adminSubs(people: Person[]): Set<string> {
  return new Set(people.filter((p) => p.isAdmin === true).map((p) => p.sub));
}

/** Role rows an admin granted (rows anyone wrote for themselves through the API are ignored). */
export function trustedRoles(roles: DeskRole[], people: Person[]): DeskRole[] {
  const admins = adminSubs(people);
  return roles.filter((r) => admins.has(r.grantedBy));
}

export function rolesOf(sub: string, roles: DeskRole[], people: Person[]): Set<DeskRoleName> {
  return new Set(trustedRoles(roles, people).filter((r) => r.personSub === sub).map((r) => r.role));
}

/** Everyone whose approval counts: admins and admin-granted approvers. */
export function approverSubs(people: Person[], roles: DeskRole[]): Set<string> {
  const out = adminSubs(people);
  for (const r of trustedRoles(roles, people)) if (r.role === 'approver') out.add(r.personSub);
  return out;
}

export function actorFor(me: Person, people: Person[], roles: DeskRole[]): Actor {
  const fresh = people.find((p) => p.sub === me.sub) ?? me;
  const isAdmin = fresh.isAdmin === true;
  const mine = rolesOf(me.sub, roles, people);
  return {
    sub: me.sub,
    name: fresh.displayName,
    isAdmin,
    canMerch: isAdmin || mine.has('merchandiser'),
    canApprove: isAdmin || mine.has('approver'),
  };
}

export function roleLabel(a: Actor): string {
  if (a.isAdmin) return 'Admin';
  if (a.canMerch && a.canApprove) return 'Merchandiser and approver';
  if (a.canApprove) return 'Approver';
  if (a.canMerch) return 'Merchandiser';
  return 'Viewer';
}
