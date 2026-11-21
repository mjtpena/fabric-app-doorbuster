/**
 * Velvet rope: the approval queue for deep discounts and loss leaders. A second person approves or sends back; the
 * owner can never approve their own deal (checked in the domain and by the Approval row policy).
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CornerUpLeft, Lock } from 'lucide-react';

import { formatDateTime, formatRelative, toMs, useAction } from '@x10/shared/lib';
import { Button, Callout, EmptyState, ErrorPanel, Field, InlineError, LinkButton, PageHeader, Skeleton, TextArea, Toast, cx } from '@x10/shared/ui';

import { Money, PaneSwatch } from '../components/bits';
import { useDesk } from '../components/useDesk';
import { pct0, pct1, rules } from '../config';
import { decide } from '../domain/deals';
import { formatClock, lensColor, type DealView } from '../domain/desk';
import { DEEP_LABEL, FLOOR_LABEL } from '../domain/pricing';
import { CATEGORY_LABEL, limits } from '../model';

export function VelvetRopePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, world, desk, actor, store, now } = useDesk();
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const queue = desk ? desk.views.filter((v) => v.status === 'pending').sort((a, b) => (a.deal.submittedAt ?? '').localeCompare(b.deal.submittedAt ?? '')) : [];
  const selected = queue.find((v) => v.deal.id === id) ?? (id ? undefined : queue.find((v) => v.deal.ownerSub !== actor.sub) ?? queue[0]);
  const recent = world
    ? [...world.approvals].sort((a, b) => toMs(b.decidedAt) - toMs(a.decidedAt)).slice(0, 6)
    : [];

  const run = useAction(async (decision: 'approved' | 'sent_back') => {
    if (!selected) return;
    await decide(store, actor, selected.deal.id, decision, note);
    setNote('');
    setToast(decision === 'approved' ? `${selected.deal.name} is approved. Its window lights at ${formatClock(toMs(selected.deal.startsAt))}.` : `${selected.deal.name} went back to ${selected.deal.ownerName}.`);
    await state.reload();
    navigate('/rope', { replace: true });
  });

  if (state.error && !desk) return <ErrorPanel error={state.error} onRetry={() => void state.reload()} />;

  return (
    <>
      <PageHeader title="Velvet rope" meta={desk ? <span className="text-ui text-muted num">{queue.length === 1 ? '1 deal waits' : `${queue.length} deals wait`} · deep discounts over {DEEP_LABEL} and loss leaders</span> : undefined} />
      {!desk ? (
        <RopeSkeleton />
      ) : queue.length === 0 ? (
        <EmptyState title="Nobody waits at the rope" icon={<Check />} action={<LinkButton to="/">Back to the arcade</LinkButton>}>
          Deals over {DEEP_LABEL} off and loss leaders queue here for a second person.
        </EmptyState>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
          <nav aria-label="Deals waiting" className={cx(id && 'hidden lg:block')}>
            <ol className="m-0 list-none divide-y divide-[var(--line)] border-y border-line p-0">
              {queue.map((v) => {
                const on = selected?.deal.id === v.deal.id;
                return (
                  <li key={v.deal.id}>
                    <Link
                      to={`/rope/${v.deal.id}`}
                      className={cx('flex items-center gap-3 px-2 py-3 text-fg no-underline transition-colors', on ? 'bg-accent-3' : 'hover:bg-surface-2')}
                      aria-current={on || undefined}
                      data-testid="rope-item"
                    >
                      <PaneSwatch color={lensColor(v, 'discount')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{v.deal.name}</span>
                        <span className="block text-xs text-muted">
                          {v.deal.ownerSub === actor.sub ? 'Yours' : v.deal.ownerName} · {formatRelative(v.deal.submittedAt, new Date(now))}
                        </span>
                      </span>
                      <span className="font-mono text-sm font-medium num">−{pct0(v.discount)}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          {selected ? (
            <article aria-labelledby="rope-title" data-testid="rope-detail">
              {id && (
                <Link to="/rope" className="mb-3 inline-flex items-center gap-1 text-ui text-muted hover:text-fg lg:hidden">
                  <ArrowLeft className="size-3.5" aria-hidden="true" /> All waiting
                </Link>
              )}
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="rope-title" className="m-0 text-xl font-semibold">
                  {selected.deal.name}
                </h2>
                <span className="font-mono text-xs text-muted">{selected.deal.sku}</span>
              </div>
              <p className="mb-5 mt-1 text-ui text-muted">
                {CATEGORY_LABEL[selected.deal.category]} · {selected.deal.ownerName} · opens {formatDateTime(selected.deal.startsAt)} for {Math.round((toMs(selected.deal.endsAt) - toMs(selected.deal.startsAt)) / 3_600_000)} h
              </p>
              <Terms v={selected} />
              {selected.deal.lossLeader && (
                <Callout tone="warn" className="mt-5" title="Loss leader">
                  {selected.deal.lossReason}
                </Callout>
              )}
              <Notes v={selected} notes={world!.notes.filter((n) => n.dealId === selected.deal.id)} />
              <Decision
                v={selected}
                mine={selected.deal.ownerSub === actor.sub}
                canApprove={actor.canApprove}
                note={note}
                setNote={setNote}
                busy={run.pending}
                onDecide={(d) => void run.run(d)}
              />
              <InlineError error={run.error} className="mt-3" />
            </article>
          ) : (
            <EmptyState title="That deal is not waiting" compact action={<LinkButton to="/rope">See who is waiting</LinkButton>}>
              It may have been approved or sent back already.
            </EmptyState>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <section className="mt-12" aria-labelledby="rope-recent">
          <h2 id="rope-recent" className="mb-3 mt-0 text-base font-semibold">
            Recent decisions
          </h2>
          <ul className="m-0 list-none divide-y divide-[var(--line)] border-y border-line p-0">
            {recent.map((a) => {
              const d = world!.deals.find((x) => x.id === a.dealId);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2.5 text-ui">
                  <span className={cx('size-2 shrink-0 rounded-full', a.decision === 'approved' ? 'bg-ok-solid' : 'bg-warn-solid')} aria-hidden="true" />
                  <span className="font-medium">{a.decision === 'approved' ? 'Approved' : 'Sent back'}</span>
                  <Link to={d ? `/ticker/${d.id}` : '/ticker'} className="text-fg">
                    {d?.name ?? 'A deleted deal'}
                  </Link>
                  <span className="text-muted">by {a.approverName}</span>
                  <span className="ml-auto font-mono text-xs text-muted">{formatDateTime(a.decidedAt)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {toast && <Toast message={toast} tone="ok" onDone={() => setToast(null)} />}
    </>
  );
}

function Terms({ v }: { v: DealView }) {
  const rows: [string, React.ReactNode, string?][] = [
    ['List price', <Money value={v.deal.listPrice} />],
    ['Deal price', <Money value={v.deal.dealPrice} />],
    ['Unit cost', <Money value={v.deal.unitCost} />],
    ['Discount', <span className="font-mono num">{pct1(v.discount)}</span>, v.discount > rules.DEEP_DISCOUNT ? `over ${DEEP_LABEL}` : undefined],
    ['Margin', <span className={cx('font-mono num', v.belowFloor && 'text-bad-text')}>{pct1(v.margin)}</span>, v.belowFloor ? `below the ${FLOOR_LABEL} floor` : undefined],
    ['Stock and target', <span className="font-mono num">{v.deal.stockUnits.toLocaleString()} / {v.deal.targetUnits.toLocaleString()}</span>],
    ['Revenue at target', <Money value={v.deal.targetUnits * v.deal.dealPrice} />],
    ['Profit at target', <Money value={v.deal.targetUnits * (v.deal.dealPrice - v.deal.unitCost)} className={v.deal.dealPrice < v.deal.unitCost ? 'text-bad-text' : undefined} />],
  ];
  return (
    <dl className="m-0 grid grid-cols-2 gap-x-8 gap-y-0 border-t border-line sm:grid-cols-4" data-testid="rope-terms">
      {rows.map(([k, val, hint]) => (
        <div key={k} className="border-b border-line py-3">
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="m-0 mt-1 text-base">{val}</dd>
          {hint && <dd className="m-0 text-xs text-warn-text">{hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

function Notes({ v, notes }: { v: DealView; notes: { id: string; authorName: string; body: string; createdAt: string }[] }) {
  if (!notes.length) return null;
  return (
    <section className="mt-6" aria-label={`Notes on ${v.deal.name}`}>
      <h3 className="mb-2 mt-0 text-sm font-semibold">Notes</h3>
      <ul className="m-0 list-none space-y-3 p-0">
        {notes.map((n) => (
          <li key={n.id} className="text-sm">
            <span className="font-medium">{n.authorName}</span> <span className="text-xs text-muted">{formatDateTime(n.createdAt)}</span>
            <p className="m-0 mt-0.5 text-fg/90">{n.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Decision({
  v,
  mine,
  canApprove,
  note,
  setNote,
  busy,
  onDecide,
}: {
  v: DealView;
  mine: boolean;
  canApprove: boolean;
  note: string;
  setNote: (s: string) => void;
  busy: boolean;
  onDecide: (d: 'approved' | 'sent_back') => void;
}) {
  if (!canApprove)
    return (
      <Callout tone="info" className="mt-6" icon={<Lock />} title="Approvers decide here">
        You can see what waits. An approver who does not own the deal approves it or sends it back.
      </Callout>
    );
  if (mine)
    return (
      <div data-testid="own-deal"><Callout tone="warn" className="mt-6" icon={<Lock />} title="You own this deal">
        Another approver has to approve it. The rope never opens for the person who set the price.
      </Callout></div>
    );
  const sendBackOk = note.trim().length >= rules.SEND_BACK_MIN;
  return (
    <section className="mt-6 border-t border-line pt-5" aria-label="Decision">
      <Field label="Note" htmlFor="rope-note" hint={`Needed to send it back (${rules.SEND_BACK_MIN}+ characters). Optional to approve.`} counter={{ value: note.length, max: limits.approvalNote.max }}>
        <TextArea id="rope-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" icon={<Check />} busy={busy} onClick={() => onDecide('approved')} data-testid="approve">
          Approve {pct0(v.discount)} off
        </Button>
        <Button icon={<CornerUpLeft />} disabled={busy || !sendBackOk} onClick={() => onDecide('sent_back')} data-testid="send-back">
          Send back
        </Button>
      </div>
    </section>
  );
}

function RopeSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]" aria-busy="true" aria-label="Loading the queue">
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={44} />
        ))}
      </div>
      <div>
        <Skeleton width={240} height={24} className="mb-4" />
        <Skeleton height={140} />
      </div>
    </div>
  );
}


