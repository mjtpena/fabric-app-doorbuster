/**
 * Floor staff (admins): who may plan deals (merchandiser) and who may approve them (approver). Admins hold both.
 * Role rows count only when an admin granted them.
 */
import { useState } from 'react';
import { Users } from 'lucide-react';

import { useAction } from '@x10/shared/lib';
import type { Person } from '@x10/shared/identity';
import { Avatar, Badge, EmptyState, ErrorPanel, InlineError, PageHeader, Skeleton, Switch, Table, TableWrap, Td, Th, Tr } from '@x10/shared/ui';

import { useWorld } from '../components/useDesk';
import { setRole } from '../domain/deals';
import { rolesOf } from '../domain/roles';
import type { DeskRoleName } from '../model';

export function StaffPage() {
  const { state, world, actor, store } = useWorld();
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = useAction(async (p: Person, role: DeskRoleName, on: boolean) => {
    setBusy(`${p.sub}:${role}`);
    try {
      await setRole(store, actor, p, role, on);
      await state.reload();
    } finally {
      setBusy(null);
    }
  });

  if (state.error && !world) return <ErrorPanel error={state.error} onRetry={() => void state.reload()} />;
  if (!actor.isAdmin && world)
    return (
      <>
        <PageHeader title="Floor staff" />
        <EmptyState title="Admins manage floor staff" icon={<Users />}>
          Ask an admin to make you a merchandiser or an approver.
        </EmptyState>
      </>
    );

  const people = world ? [...world.people].sort((a, b) => Number(!!b.isAdmin) - Number(!!a.isAdmin) || a.displayName.localeCompare(b.displayName)) : [];
  return (
    <>
      <PageHeader title="Floor staff" meta={world ? <span className="text-ui text-muted num">{people.length} people</span> : undefined} />
      {!world ? (
        <Skeleton height={240} />
      ) : (
        <TableWrap label="People and desk roles">
          <Table data-testid="staff-table">
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Merchandiser</Th>
                <Th>Approver</Th>
                <Th className="hidden sm:table-cell">Can</Th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const roles = rolesOf(p.sub, world.roles, world.people);
                const admin = p.isAdmin === true;
                const can = admin ? 'Plan and approve (admin)' : roles.has('merchandiser') && roles.has('approver') ? 'Plan and approve' : roles.has('approver') ? 'Approve others’ deals' : roles.has('merchandiser') ? 'Plan own deals' : 'View only';
                return (
                  <Tr key={p.id} data-testid="staff-row">
                    <Td>
                      <span className="flex items-center gap-3">
                        <Avatar name={p.displayName} size="sm" />
                        <span>
                          <span className="block font-medium">{p.displayName}</span>
                          <span className="block text-xs text-muted">{p.email ?? '—'}</span>
                        </span>
                      </span>
                    </Td>
                    {(['merchandiser', 'approver'] as const).map((r) => (
                      <Td key={r}>
                        {admin ? (
                          <Badge tone="brand">Admin</Badge>
                        ) : (
                          <Switch
                            label={`${p.displayName} is ${r === 'merchandiser' ? 'a merchandiser' : 'an approver'}`}
                            checked={roles.has(r)}
                            onChange={(on) => void toggle.run(p, r, on)}
                            disabled={busy === `${p.sub}:${r}`}
                          />
                        )}
                      </Td>
                    ))}
                    <Td muted className="hidden sm:table-cell">{can}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <InlineError error={toggle.error} className="mt-3" />
      <p className="mt-4 text-ui text-muted">Admins come from the Person table (isAdmin), set in SQL by whoever deployed the app.</p>
    </>
  );
}
