/**
 * Promo calendar: every deal as a bar on its SKU's lane, grouped by category, with the clock's "now" line. One SKU
 * never carries two overlapping bars (the Shopfront refuses it), so each lane reads left to right.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange } from 'lucide-react';

import { DAY, HOUR, formatDateTime, toMs } from '@x10/shared/lib';
import { EmptyState, ErrorPanel, LinkButton, PageHeader, SegmentedControl, Skeleton, cx } from '@x10/shared/ui';

import { useDesk } from '../components/useDesk';
import { pct0 } from '../config';
import { formatClock, type DealView } from '../domain/desk';
import { CATEGORIES, CATEGORY_LABEL } from '../model';

type Range = 'event' | 'week' | 'all';

const BAR: Record<string, string> = {
  live: 'bg-ok-soft text-ok-text border-l-[3px] border-l-[var(--ok-solid)]',
  approved: 'bg-info-soft text-info-text border-l-[3px] border-l-[var(--info-solid)]',
  pending: 'bg-warn-soft text-warn-text border-l-[3px] border-l-[var(--warn-solid)]',
  draft: 'bg-surface text-muted border border-dashed border-line-strong',
  ended: 'bg-gray-3 text-gray-11 border-l-[3px] border-l-[var(--gray-8)]',
  soldout: 'bg-bad-soft text-bad-text border-l-[3px] border-l-[var(--bad-solid)]',
  cancelled: 'bg-transparent text-faint line-through border border-line',
};

function barKind(v: DealView): string {
  if (v.soldOut) return 'soldout';
  return v.status;
}

export function CalendarPage() {
  const { state, desk, now } = useDesk();
  const [range, setRange] = useState<Range>('event');

  const span = useMemo(() => {
    if (!desk) return null;
    if (range === 'event') return { from: desk.day.from, to: desk.day.to };
    if (range === 'week') return { from: desk.day.from - DAY, to: desk.day.from + 6 * DAY };
    const all = desk.views.map((v) => [toMs(v.deal.startsAt), toMs(v.deal.endsAt)]).flat();
    return all.length ? { from: Math.floor(Math.min(...all) / HOUR) * HOUR, to: Math.ceil(Math.max(...all) / HOUR) * HOUR } : { from: desk.day.from, to: desk.day.to };
  }, [desk, range]);

  if (state.error && !desk) return <ErrorPanel error={state.error} onRetry={() => void state.reload()} />;

  const views = desk && span ? desk.views.filter((v) => toMs(v.deal.endsAt) > span.from && toMs(v.deal.startsAt) < span.to) : [];
  const lanes = CATEGORIES.map((c) => {
    const inCat = views.filter((v) => v.deal.category === c);
    const skus = [...new Set(inCat.map((v) => v.deal.sku))].sort();
    return { category: c, skus: skus.map((sku) => ({ sku, deals: inCat.filter((v) => v.deal.sku === sku) })) };
  }).filter((l) => l.skus.length);

  return (
    <>
      <PageHeader
        title="Promo calendar"
        meta={desk ? <span className="text-ui text-muted num">{views.length} deals on {new Set(views.map((v) => v.deal.sku)).size} SKUs</span> : undefined}
        actions={
          <SegmentedControl<Range>
            label="Range"
            size="sm"
            value={range}
            onChange={setRange}
            options={[
              { value: 'event', label: 'Event' },
              { value: 'week', label: 'Week' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      />
      {!desk || !span ? (
        <div aria-busy="true" aria-label="Loading the calendar" className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} height={30} />
          ))}
        </div>
      ) : lanes.length === 0 ? (
        <EmptyState title="Nothing on the calendar" icon={<CalendarRange />} action={<LinkButton to="/shopfront" variant="primary">Plan a deal</LinkButton>}>
          No deal runs in this range. Try the whole calendar, or plan one in the Shopfront.
        </EmptyState>
      ) : (
        <Timeline lanes={lanes} from={span.from} to={span.to} now={now} />
      )}
      <ul className="mt-5 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-xs text-muted" aria-label="Key">
        {[
          ['live', 'Live'],
          ['approved', 'Scheduled'],
          ['pending', 'Awaiting approval'],
          ['draft', 'Draft'],
          ['soldout', 'Sold out'],
          ['ended', 'Ended'],
        ].map(([k, label]) => (
          <li key={k} className="inline-flex items-center gap-2">
            <span className={cx('inline-block h-2.5 w-5 rounded-[3px]', BAR[k])} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </>
  );
}

function Timeline({ lanes, from, to, now }: { lanes: { category: string; skus: { sku: string; deals: DealView[] }[] }[]; from: number; to: number; now: number }) {
  const span = to - from;
  const left = (t: number) => `${(Math.max(0, Math.min(span, t - from)) / span) * 100}%`;
  const width = (a: number, b: number) => `${(Math.max(0, Math.min(to, b) - Math.max(from, a)) / span) * 100}%`;
  const step = span <= 1.1 * DAY ? 3 * HOUR : span <= 8 * DAY ? DAY : 7 * DAY;
  const marks: number[] = [];
  for (let t = Math.ceil(from / step) * step; t < to; t += step) marks.push(t);
  const label = (t: number) =>
    step < DAY ? new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(t) : new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' }).format(t);

  return (
    <div className="overflow-x-auto rounded-xl border border-line" data-testid="promo-calendar">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[112px_minmax(0,1fr)] border-b border-line bg-surface-sunken text-xs text-muted sm:grid-cols-[150px_minmax(0,1fr)]">
          <div className="sticky left-0 z-[2] bg-surface-sunken px-3 py-2">SKU</div>
          <div className="relative h-8">
            {marks.map((m) => (
              <span key={m} className="absolute top-2 -translate-x-1/2 font-mono num" style={{ left: left(m) }}>
                {label(m)}
              </span>
            ))}
          </div>
        </div>
        {lanes.map((lane) => (
          <div key={lane.category} role="group" aria-label={CATEGORY_LABEL[lane.category as keyof typeof CATEGORY_LABEL]}>
            <div className="sticky left-0 border-b border-line bg-surface px-3 pb-1 pt-3 x-legend-label text-muted">{CATEGORY_LABEL[lane.category as keyof typeof CATEGORY_LABEL]}</div>
            {lane.skus.map(({ sku, deals }) => (
              <div key={sku} className="grid grid-cols-[112px_minmax(0,1fr)] border-b border-line last:border-0 sm:grid-cols-[150px_minmax(0,1fr)]" data-testid="calendar-lane" data-sku={sku}>
                <div className="sticky left-0 z-[2] truncate bg-surface px-3 py-2 font-mono text-xs text-muted">{sku}</div>
                <div className="relative h-10">
                  {marks.map((m) => (
                    <span key={m} className="absolute inset-y-0 w-px bg-[var(--line)]" style={{ left: left(m) }} aria-hidden="true" />
                  ))}
                  {now > from && now < to && <span className="absolute inset-y-0 z-[1] w-px bg-accent-9" style={{ left: left(now) }} aria-hidden="true" />}
                  {deals.map((v) => {
                    const s = toMs(v.deal.startsAt);
                    const e = toMs(v.deal.endsAt);
                    const k = barKind(v);
                    return (
                      <Link
                        key={v.deal.id}
                        to={`/ticker/${v.deal.id}`}
                        className={cx('absolute top-1.5 flex h-7 min-w-[6px] items-center overflow-hidden rounded-md px-2 text-xs font-medium no-underline transition-[filter] hover:brightness-110', BAR[k])}
                        style={{ left: left(s), width: width(s, e) }}
                        title={`${v.deal.name}: ${formatDateTime(v.deal.startsAt)} to ${formatDateTime(v.deal.endsAt)} · ${v.label}`}
                        data-testid="calendar-bar"
                        data-state={k}
                      >
                        {v.soldOut && v.soldOutAt && (
                          <span
                            className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(45deg,transparent_0_4px,color-mix(in_oklab,var(--bad-solid)_22%,transparent)_4px_7px)]"
                            style={{ width: `${((e - toMs(v.soldOutAt)) / Math.max(1, e - s)) * 100}%` }}
                            aria-hidden="true"
                          />
                        )}
                        <span className="relative truncate">
                          {v.deal.name} · −{pct0(v.discount)}
                          {v.soldOut && v.soldOutAt ? ` · out ${formatClock(toMs(v.soldOutAt))}` : ''}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
