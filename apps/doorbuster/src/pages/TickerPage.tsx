/**
 * Ticker: the live sales feed and every deal's sparkline with its sell-out projection; /ticker/:id is one deal in
 * full (forecast, chart, terms, approval, notes). The till simulator appends sales for live deals every 5 seconds.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Activity, Store, Wand2 } from 'lucide-react';

import { formatDateTime, formatRelative, HOUR, toMs, useAction, usePolling } from '@x10/shared/lib';
import {
  Button,
  Callout,
  EmptyState,
  ErrorPanel,
  Field,
  InlineError,
  LinkButton,
  PageHeader,
  Skeleton,
  Stat,
  StatStrip,
  Switch,
  Table,
  TableWrap,
  Td,
  TextArea,
  Th,
  Tr,
  cx,
} from '@x10/shared/ui';

import { Money, SellBar, Sparkline, StatusBadge } from '../components/bits';
import { SalesChart } from '../components/SalesChart';
import { useDesk } from '../components/useDesk';
import { money, pct0, pct1, rules } from '../config';
import { addNote, simulateSales } from '../domain/deals';
import { compactMoney, forecastText, formatClock, type DealView } from '../domain/desk';
import { lastHourUnits, salesRate } from '../domain/forecast';
import { CATEGORY_LABEL, limits, type SaleTick } from '../model';

export function TickerPage() {
  const { id } = useParams();
  return id ? <DealTicker id={id} /> : <TickerBoard />;
}

/* ------------------------------------------------------------------ the board */

function useSimulator(onTick: () => Promise<void>) {
  const { store, actor } = useDesk(null, false);
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePolling(
    async () => {
      try {
        await simulateSales(store, actor, new Date(), 10);
        await onTick();
      } catch (e) {
        setError((e as Error).message);
        setOn(false);
      }
    },
    rules.POLL_MS,
    on,
  );
  return { on, setOn, error, allowed: actor.canMerch };
}

function TickerBoard() {
  const { state, world, desk, now } = useDesk();
  const sim = useSimulator(state.reload);
  if (state.error && !desk) return <ErrorPanel error={state.error} onRetry={() => void state.reload()} />;

  const views = desk ? desk.views.filter((v) => v.ticks.length > 0 || v.status === 'live').sort((a, b) => rank(a) - rank(b) || b.revenue - a.revenue) : [];
  const units = views.reduce((s, v) => s + v.sold, 0);
  const revenue = views.reduce((s, v) => s + v.revenue, 0);
  const names = new Map(world?.deals.map((d) => [d.id, d.name]) ?? []);
  const feed = world ? [...world.ticks].sort((a, b) => toMs(b.at) - toMs(a.at)).slice(0, 24) : [];

  return (
    <>
      <PageHeader
        title="Ticker"
        meta={<span className="inline-flex items-center gap-2 text-ui text-muted"><span className="size-2 rounded-full bg-ok-solid" aria-hidden="true" /> Live · updates every {rules.POLL_MS / 1000} s</span>}
        actions={
          sim.allowed ? (
            <span className="inline-flex items-center gap-2 text-ui">
              <Switch label="Run the till simulator" checked={sim.on} onChange={sim.setOn} />
              <span>Till simulator</span>
            </span>
          ) : undefined
        }
      />
      {sim.error && <Callout tone="bad" className="mb-4" title="The simulator stopped">{sim.error}</Callout>}
      {!desk ? (
        <BoardSkeleton />
      ) : (
        <>
          <StatStrip className="mb-8">
            <Stat label="Units sold" value={<span className="num">{units.toLocaleString()}</span>} />
            <Stat label="Revenue" value={<span className="num">{compactMoney(revenue)}</span>} />
            <Stat label="Live now" value={<span className="num">{desk.views.filter((v) => v.status === 'live').length}</span>} />
            <Stat label="Sold out" value={<span className="num">{desk.views.filter((v) => v.soldOut).length}</span>} tone={desk.views.some((v) => v.soldOut) ? 'bad' : undefined} />
          </StatStrip>
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section aria-labelledby="ticker-deals">
              <h2 id="ticker-deals" className="mb-3 mt-0 text-base font-semibold">
                Sell-through and forecast
              </h2>
              {views.length === 0 ? (
                <EmptyState title="No sales yet" icon={<Activity />} compact bordered action={<LinkButton to="/receipts">Import receipts</LinkButton>}>
                  Sales arrive from Receipts imports or the till simulator.
                </EmptyState>
              ) : (
                <>
                <ol className="m-0 list-none divide-y divide-[var(--line)] border-y border-line p-0 md:hidden" aria-label="Deals with sales">
                  {views.map((v) => (
                    <li key={v.deal.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <Link to={`/ticker/${v.deal.id}`} className="block font-medium text-fg">
                            {v.deal.name}
                          </Link>
                          <span className="mt-1 flex items-center gap-3">
                            <StatusBadge v={v} />
                            <SellBar v={v} width={56} />
                          </span>
                        </span>
                        <Sparkline v={v} now={now} width={104} height={34} className="shrink-0" />
                      </div>
                      <p className={cx('mb-0 mt-1.5 text-ui', v.status === 'live' && v.forecast.kind === 'early' ? 'font-medium text-warn-text' : 'text-muted')}>
                        {v.status === 'live' || v.soldOut ? forecastText(v.forecast, v.deal.endsAt) : v.label}
                      </p>
                    </li>
                  ))}
                </ol>
                <div className="hidden md:block">
                <TableWrap label="Deals with sales">
                  <Table data-testid="ticker-table">
                    <thead>
                      <tr>
                        <Th>Deal</Th>
                        <Th>Units over the window</Th>
                        <Th>Sold</Th>
                        <Th numeric>Last hour</Th>
                        <Th>Forecast</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {views.map((v) => (
                        <Tr key={v.deal.id} data-testid="ticker-row" data-sku={v.deal.sku}>
                          <Td>
                            <Link to={`/ticker/${v.deal.id}`} className="block font-medium text-fg">
                              {v.deal.name}
                            </Link>
                            <span className="mt-0.5 flex items-center gap-2">
                              <StatusBadge v={v} />
                            </span>
                          </Td>
                          <Td>
                            <Sparkline v={v} now={now} width={140} height={34} />
                          </Td>
                          <Td>
                            <SellBar v={v} width={72} />
                          </Td>
                          <Td numeric>{lastHourUnits(v.ticks, now)}</Td>
                          <Td className={cx('min-w-[180px] text-ui', v.status === 'live' && v.forecast.kind === 'early' ? 'font-medium text-warn-text' : 'text-muted')}>
                            {v.status === 'live' || v.soldOut ? forecastText(v.forecast, v.deal.endsAt) : v.label}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
                </div>
                </>
              )}
            </section>
            <section aria-labelledby="ticker-feed">
              <h2 id="ticker-feed" className="mb-3 mt-0 text-base font-semibold">
                Latest sales
              </h2>
              <Feed ticks={feed} names={names} now={now} />
            </section>
          </div>
        </>
      )}
    </>
  );
}

const rank = (v: DealView) => (v.status === 'live' ? (v.forecast.kind === 'early' ? 0 : 1) : v.soldOut ? 2 : 3);

function Feed({ ticks, names, now }: { ticks: SaleTick[]; names: Map<string, string>; now: number }) {
  if (!ticks.length) return <p className="m-0 text-ui text-muted">Nothing sold yet.</p>;
  return (
    <ol className="m-0 list-none divide-y divide-[var(--line)] border-y border-line p-0" data-testid="sales-feed">
      {ticks.map((k) => (
        <li key={k.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-baseline gap-3 py-2 text-ui">
          <span className="font-mono text-xs text-muted num" title={formatDateTime(k.at)}>
            {formatClock(toMs(k.at))}
          </span>
          <span className="min-w-0">
            <span className="block truncate">{names.get(k.dealId) ?? k.sku}</span>
            <span className="text-xs text-faint">{k.source === 'seed' ? 'till' : k.source}{now - toMs(k.at) < HOUR ? ` · ${formatRelative(k.at, new Date(now))}` : ''}</span>
          </span>
          <span className="text-right">
            <span className="block font-mono font-medium num">+{k.units}</span>
            <span className="block font-mono text-xs text-muted num">{money(k.revenue, 0)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ one deal */

function DealTicker({ id }: { id: string }) {
  const { state, world, desk, actor, store, now } = useDesk();
  const [body, setBody] = useState('');
  const note = useAction(async () => {
    await addNote(store, actor, id, body);
    setBody('');
    await state.reload();
  });
  if (state.error && !desk) return <ErrorPanel error={state.error} onRetry={() => void state.reload()} />;
  if (!desk || !world) return <BoardSkeleton detail />;
  const v = desk.views.find((x) => x.deal.id === id);
  if (!v)
    return (
      <EmptyState title="That deal is gone" icon={<Store />} action={<LinkButton to="/ticker">Back to the Ticker</LinkButton>}>
        Drafts can be deleted by their owner.
      </EmptyState>
    );
  const d = v.deal;
  const rate = salesRate(v.ticks, d.startsAt, now);
  const notes = world.notes.filter((n) => n.dealId === id).sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
  const mine = d.ownerSub === actor.sub;
  const ticks = [...v.ticks].sort((a, b) => toMs(b.at) - toMs(a.at)).slice(0, 8);
  const names = new Map([[d.id, d.name]]);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/ticker" className="inline-flex items-center gap-1 text-ui text-muted hover:text-fg">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Ticker
          </Link>
        }
        title={d.name}
        meta={
          <>
            <StatusBadge v={v} />
            <span className="font-mono text-xs">{d.sku}</span>
            <span className="text-ui text-muted">
              {CATEGORY_LABEL[d.category]} · {mine ? 'your deal' : d.ownerName}
            </span>
          </>
        }
        actions={
          <>
            {v.status === 'pending' && actor.canApprove && !mine && (
              <LinkButton to={`/rope/${d.id}`} variant="primary" icon={<Wand2 />}>
                Velvet rope
              </LinkButton>
            )}
            {mine && v.status !== 'ended' && v.status !== 'cancelled' && (
              <LinkButton to={`/shopfront/${d.id}`} icon={<Store />}>
                Edit
              </LinkButton>
            )}
            <LinkButton to="/" state={{ focus: d.id }}>
              See the window
            </LinkButton>
          </>
        }
      />

      <ForecastCallout v={v} rate={rate?.rate ?? null} />

      <section className="mt-6" aria-label="Sales chart">
        <SalesChart v={v} now={now} />
      </section>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 border-t border-line sm:grid-cols-4" data-testid="deal-facts">
        <Fact k="Sold" v={<span className="font-mono num">{v.sold.toLocaleString()} / {d.stockUnits.toLocaleString()}</span>} hint={`${pct0(v.sellThrough)} of stock · target ${d.targetUnits}`} />
        <Fact k="Revenue" v={<Money value={v.revenue} />} />
        <Fact k={`Rate, last ${rules.RATE_WINDOW_HOURS} h`} v={<span className="font-mono num">{rate ? `${rate.rate.toFixed(1)}/h` : '—'}</span>} />
        <Fact k="Last hour" v={<span className="font-mono num">{lastHourUnits(v.ticks, now)}</span>} />
        <Fact k="Deal price" v={<Money value={d.dealPrice} />} hint={`list ${money(d.listPrice)} · ${pct0(v.discount)} off`} />
        <Fact k="Margin" v={<span className={cx('font-mono num', v.belowFloor && 'text-bad-text')}>{pct1(v.margin)}</span>} hint={`cost ${money(d.unitCost)}${d.lossLeader ? ' · loss leader' : ''}`} />
        <Fact k="Window" v={<span className="font-mono text-sm num">{formatClock(toMs(d.startsAt))}–{formatClock(toMs(d.endsAt))}</span>} hint={formatDateTime(d.startsAt)} />
        <Fact k="Approval" v={<span className="text-sm">{v.approval ? v.approval.approverName : v.needsApproval ? 'Waiting' : 'Not needed'}</span>} hint={v.approval ? formatDateTime(v.approval.decidedAt) : undefined} />
      </dl>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="deal-notes">
          <h2 id="deal-notes" className="mb-3 mt-0 text-base font-semibold">
            Notes
          </h2>
          {notes.length === 0 && <p className="mt-0 text-ui text-muted">No notes yet.</p>}
          <ul className="m-0 mb-4 list-none space-y-4 p-0" data-testid="notes">
            {notes.map((n) => (
              <li key={n.id} className="text-sm">
                <span className="font-medium">{n.authorName}</span> <span className="text-xs text-muted">{formatDateTime(n.createdAt)}</span>
                <p className="m-0 mt-0.5">{n.body}</p>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void note.run();
            }}
          >
            <Field label="Add a note" htmlFor="deal-note" counter={{ value: body.length, max: limits.noteBody.max }}>
              <TextArea id="deal-note" rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <Button type="submit" busy={note.pending} disabled={!body.trim()}>
              Add note
            </Button>
            <InlineError error={note.error} className="mt-2" />
          </form>
        </section>
        <section aria-labelledby="deal-ticks">
          <h2 id="deal-ticks" className="mb-3 mt-0 text-base font-semibold">
            Latest sales
          </h2>
          <Feed ticks={ticks} names={names} now={now} />
          {v.ticks.length > ticks.length && <p className="mb-0 mt-2 text-xs text-muted">{v.ticks.length - ticks.length} earlier sales not shown.</p>}
        </section>
      </div>
    </>
  );
}

function ForecastCallout({ v, rate }: { v: DealView; rate: number | null }) {
  const f = v.forecast;
  const end = formatClock(toMs(v.deal.endsAt));
  const text = forecastText(f, v.deal.endsAt);
  if (v.soldOut && f.kind === 'soldOut')
    return (
      <div data-testid="forecast" data-kind="soldOut">
        <Callout tone="bad" title={text}>
          The window closed early and its light went out. {v.deal.stockUnits.toLocaleString()} units sold.
        </Callout>
      </div>
    );
  if (v.status !== 'live')
    return (
      <div data-testid="forecast" data-kind={f.kind}>
        <Callout tone="info" title={v.status === 'approved' ? text : v.label}>
          {v.status === 'pending' ? 'No forecast until the deal is approved and selling.' : v.status === 'approved' ? 'The forecast starts once it has sold for a while.' : 'No forecast for a deal that is not selling.'}
        </Callout>
      </div>
    );
  if (f.kind === 'early')
    return (
      <div data-testid="forecast" data-kind="early">
        <Callout tone="warn" title={`Sells out around ${formatClock(toMs(f.at))}, before the deal ends at ${end}`}>
          {`At ${f.rate.toFixed(1)} units an hour over the last ${rules.RATE_WINDOW_HOURS} h, the last ${f.remaining} units go in ${Math.round(f.hoursToSellOut * 60)} minutes. Top up stock or end the deal early on purpose.`}
        </Callout>
      </div>
    );
  if (f.kind === 'lasts')
    return (
      <div data-testid="forecast" data-kind="lasts">
        <Callout tone={f.projectedUnits < v.deal.targetUnits ? 'info' : 'ok'} title={`Lasts to the end at ${end}`}>
          {`At ${f.rate.toFixed(1)} units an hour, about ${f.projectedUnits.toLocaleString()} sell by the end${f.projectedUnits < v.deal.targetUnits ? `, short of the ${v.deal.targetUnits} target` : ', past the target'}. Projected sell-out ${formatDateTime(f.at)}.`}
        </Callout>
      </div>
    );
  return (
    <div data-testid="forecast" data-kind={f.kind}>
      <Callout tone="info" title={text}>
        {rate === 0 ? 'Nothing sold recently, so there is nothing to project.' : 'The forecast needs at least 15 minutes of selling.'}
      </Callout>
    </div>
  );
}

function Fact({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) {
  return (
    <div className="border-b border-line py-3">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="m-0 mt-1 text-base">{v}</dd>
      {hint && <dd className="m-0 mt-0.5 text-xs text-muted">{hint}</dd>}
    </div>
  );
}

function BoardSkeleton({ detail }: { detail?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading sales">
      <Skeleton width={220} height={26} className="mb-6" />
      <Skeleton height={detail ? 60 : 72} className="mb-8" />
      {Array.from({ length: detail ? 1 : 6 }, (_, i) => (
        <Skeleton key={i} height={detail ? 220 : 40} className="mb-3" />
      ))}
    </div>
  );
}


