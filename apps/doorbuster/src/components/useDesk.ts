import { useMemo } from 'react';

import { useAsync, useNow, usePolling } from '@x10/shared/lib';
import { useApp } from '@x10/shared/runtime';

import { rules } from '../config';
import { loadWorld } from '../domain/deals';
import { buildDesk } from '../domain/desk';
import { actorFor, type Actor } from '../domain/roles';
import type { Schema } from '../model';

/** The whole deal desk (deals, ticks, notes, approvals, roles, people), polled every 5 s. */
export function useWorld(poll = true) {
  const { store, me } = useApp<Schema>();
  const state = useAsync(() => loadWorld(store), [store]);
  usePolling(state.reload, rules.POLL_MS, poll);
  const actor: Actor = useMemo(
    () => (state.data ? actorFor(me, state.data.people, state.data.roles) : { sub: me.sub, name: me.displayName, isAdmin: !!me.isAdmin, canMerch: !!me.isAdmin, canApprove: !!me.isAdmin }),
    [state.data, me],
  );
  return { state, world: state.data, actor, me, store };
}

/** The desk at `at` (default: now, ticking every 15 s). */
export function useDesk(at?: number | null, poll = true) {
  const w = useWorld(poll);
  const clock = useNow(15_000);
  const now = clock.getTime();
  const desk = useMemo(() => (w.world ? buildDesk(w.world, now, at ?? undefined) : null), [w.world, now, at]);
  return { ...w, desk, now };
}
