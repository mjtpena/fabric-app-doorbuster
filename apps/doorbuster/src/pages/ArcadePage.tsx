/**
 * Home: the midnight arcade. Lenses re-light the windows (keys 1–5), view as merchandiser or approver steps back what
 * is not yours (V), Today focuses the window behind each item, the clock replays the day (R), L switches to the list.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpDown, Keyboard, Pause, Play, RotateCcw, Search, ShoppingBag, Store, Wand2 } from 'lucide-react';

import { HOUR, MINUTE, toMs } from '@x10/shared/lib';
import {
  Button,
  Dialog,
  IconButton,
  Input,
  Kbd,
  Legend,
  LensBar,
  LinkButton,
  Spinner,
  StageMessage,
  StagePage,
  Table,
  TableWrap,
  Td,
  Th,
  TodayPanel,
  Tr,
  ViewAsSwitch,
  ViewToggle,
  useHotkeys,
  useIsDesktop,
  useReducedMotion,
  type LegendItem,
  type LensOption,
  type StageView,
  type TodayItem,
} from '@x10/shared/ui';
import { Link } from 'react-router-dom';

import { ArcadeScene } from '../arcade/ArcadeScene';
import { PaneSwatch, SellBar, StatusBadge } from '../components/bits';
import { useDesk } from '../components/useDesk';
import { money, pct0, pct1, rules } from '../config';
import { cumulativeSeries } from '../domain/forecast';
import {
  buildDesk,
  defaultViewAs,
  forecastText,
  formatClock,
  groupKey,
  groupLabel,
  isRelevant,
  lensColor,
  lensGroups,
  LENS_LABEL,
  todayFor,
  type DealView,
  type Desk,
  type Lens,
  type ViewAs,
} from '../domain/desk';
import { CATEGORY_LABEL } from '../model';

const LENSES: LensOption<Lens>[] = [
  { value: 'sell', label: 'Sell-through', swatch: 'linear-gradient(90deg, color-mix(in oklab, var(--db-neon-volt) 30%, var(--gray-12)), var(--db-neon-volt), white)', description: 'Brighter windows have sold more of their stock' },
  { value: 'margin', label: 'Margin', swatch: 'conic-gradient(var(--db-neon-bad) 0 25%, var(--db-neon-warn) 0 50%, var(--db-neon-ok) 0 75%, var(--db-neon-info) 0)', description: 'Margin on the deal price against the floor' },
  { value: 'discount', label: 'Discount', swatch: 'linear-gradient(90deg, var(--db-neon-info), var(--db-neon-volt), var(--db-neon-hot))', description: 'How deep the discount is; deep ones need a second person' },
  { value: 'risk', label: 'Sell-out risk', swatch: 'conic-gradient(var(--db-neon-bad) 0 25%, var(--db-neon-warn) 0 50%, var(--db-neon-info) 0 75%, var(--db-neon-ok) 0)', description: 'Sold out, selling out early, short of target or on track' },
  { value: 'category', label: 'Category', swatch: 'conic-gradient(var(--db-cat-electronics) 0 17%, var(--db-cat-home) 0 33%, var(--db-cat-fashion) 0 50%, var(--db-cat-toys) 0 67%, var(--db-cat-beauty) 0 83%, var(--db-cat-grocery) 0)', description: 'Storefront blocks by category' },
];

const PREF_KEY = 'x10:doorbuster:arcade';
function readPrefs(): { lens?: Lens; view?: StageView } {
  try {
    return JSON.parse(sessionStorage.getItem(PREF_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Deals that belong to this event (their window touches the 24 hours on the clock). */
function inEvent(desk: Desk): DealView[] {
  return desk.views.filter((v) => toMs(v.deal.endsAt) > desk.day.from && toMs(v.deal.startsAt) < desk.day.to);
}

function legendFor(views: DealView[], lens: Lens): LegendItem[] {
  const groups = lensGroups(lens);
  const items: LegendItem[] = groups
    .map((g) => ({ label: g.label, color: g.color, shape: 'square' as const, value: views.filter((v) => groupKey(v, lens) === g.key).length }))
    .filter((g) => g.value > 0 || lens === 'risk' || lens === 'margin');
  // One key for the scene's own marks, chosen for the lens so the legend never grows past six rows.
  if (lens === 'sell' || lens === 'margin') items.push({ label: `Shopper = ${rules.CROWD_UNITS_PER_SHOPPER} units/h`, icon: <QueueGlyph /> });
  if (lens === 'discount' && views.some((v) => v.status === 'pending')) items.push({ label: 'Rope: awaits approval', color: 'var(--db-rope)', shape: 'line' });
  if (lens === 'risk' && views.some((v) => v.status === 'live' && v.forecast.kind === 'early')) items.push({ label: 'Shutter: out early', color: 'var(--db-neon-warn)', shape: 'dash' });
  return items.slice(0, 6);
}

function QueueGlyph() {
  return (
    <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden="true">
      <circle cx="4" cy="3.5" r="1.8" fill="currentColor" />
      <rect x="2.2" y="5.6" width="3.6" height="7" rx="1.6" fill="currentColor" />
      <circle cx="10" cy="3.5" r="1.8" fill="currentColor" opacity="0.6" />
      <rect x="8.2" y="5.6" width="3.6" height="7" rx="1.6" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

export function ArcadePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const nav = (location.state as { focus?: string } | null) ?? null;
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();
  const prefs = useMemo(readPrefs, []);
  const [lens, setLens] = useState<Lens>(prefs.lens ?? 'sell');
  const [view, setView] = useState<StageView>(prefs.view ?? 'stage');
  const [viewAs, setViewAs] = useState<ViewAs | null>(null);
  const [focus, setFocus] = useState<string | null>(nav?.focus ?? null);
  const [t, setT] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [help, setHelp] = useState(false);
  const [q, setQ] = useState('');
  const findRef = useRef<HTMLInputElement>(null);

  const { state, world, desk, actor, now } = useDesk(t);
  const role: ViewAs = viewAs ?? defaultViewAs(actor);

  useEffect(() => {
    try {
      sessionStorage.setItem(PREF_KEY, JSON.stringify({ lens, view }));
    } catch {
      /* preferences are a convenience */
    }
  }, [lens, view]);

  const deskNow = useMemo(() => (world ? buildDesk(world, now) : null), [world, now]);
  const views = useMemo(() => (desk ? inEvent(desk) : []), [desk]);
  const order = useMemo(
    () => [...views].sort((a, b) => a.deal.category.localeCompare(b.deal.category) || a.deal.startsAt.localeCompare(b.deal.startsAt)).map((v) => v.deal.id),
    [views],
  );
  const bars = useMemo(() => {
    if (!deskNow) return [];
    const ids = new Set(inEvent(deskNow).map((v) => v.deal.id));
    const ticks = deskNow.views.filter((v) => ids.has(v.deal.id)).flatMap((v) => v.ticks);
    return cumulativeSeries(ticks, deskNow.day.from, now, 15 * MINUTE).map((b) => ({ t: b.t, units: b.units }));
  }, [deskNow, now]);

  const entries = useMemo(() => (deskNow ? todayFor(deskNow, role, actor) : []), [deskNow, role, actor]);
  const today: TodayItem[] = entries.map((e) => ({ id: e.id, title: e.title, severity: e.severity, value: e.value, unit: e.unit, lens: LENS_LABEL[e.lens], meta: e.meta }));
  const focused = views.find((v) => v.deal.id === focus) ?? null;
  const isDim = useCallback((v: DealView) => !isRelevant(v, role, actor, views), [role, actor, views]);

  /* Replay the day: the playhead runs from the event's first hour to now. */
  useEffect(() => {
    if (!playing || !deskNow) return;
    const from = deskNow.day.from;
    const end = now;
    const start = t ?? from;
    if (reduced) {
      let cur = start >= end - MINUTE ? from : start;
      const id = window.setInterval(() => {
        cur = Math.min(end, cur + HOUR);
        setT(cur >= end ? null : cur);
        if (cur >= end) setPlaying(false);
      }, 700);
      return () => window.clearInterval(id);
    }
    const t0 = performance.now();
    const begin = start >= end - MINUTE ? from : start;
    const dur = 11_000 * ((end - begin) / Math.max(1, end - from));
    let raf = 0;
    const step = (ts: number) => {
      const k = Math.min(1, (ts - t0) / Math.max(1, dur));
      const v = begin + (end - begin) * k;
      if (k >= 1) {
        setT(null);
        setPlaying(false);
        return;
      }
      setT(Math.round(v / MINUTE) * MINUTE);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const pick = (id: string) => setFocus((f) => (f === id ? null : id));
  const stepFocus = (dir: 1 | -1) => {
    if (!order.length) return;
    const i = focus ? order.indexOf(focus) : -1;
    setFocus(order[(i + dir + order.length) % order.length]);
  };
  const open = () => focused && navigate(`/ticker/${focused.deal.id}`);
  const fly = () => {
    const words = q.trim().toLowerCase();
    if (!words) return;
    const hit = views.find((v) => v.deal.name.toLowerCase().includes(words) || v.deal.sku.toLowerCase().includes(words));
    if (hit) {
      setFocus(hit.deal.id);
      setView('stage');
    }
  };
  const scrub = (v: number) => {
    setPlaying(false);
    setT(v >= now - MINUTE ? null : v);
  };

  useHotkeys({
    'shift+?': () => setHelp(true),
    escape: () => {
      if (playing || t !== null) {
        setPlaying(false);
        setT(null);
      } else setFocus(null);
    },
    arrowright: () => stepFocus(1),
    arrowleft: () => stepFocus(-1),
    o: open,
    n: () => navigate('/shopfront'),
    r: () => setPlaying((p) => !p),
    '/': () => findRef.current?.focus(),
  });

  const viewAsSwitch = (
    <ViewAsSwitch<ViewAs>
      value={role}
      onChange={setViewAs}
      glass={!desktop}
      className={desktop ? 'bg-gray-3' : undefined}
      options={[
        { value: 'all', label: 'All' },
        { value: 'merchandiser', label: 'Merchandiser' },
        { value: 'approver', label: 'Approver' },
      ]}
    />
  );

  const counts = {
    live: views.filter((v) => v.status === 'live').length,
    soldOut: views.filter((v) => v.soldOut).length,
    pending: views.filter((v) => v.status === 'pending').length,
  };
  const meta = focused ? (
    <FocusMeta v={focused} me={actor.sub} canApprove={actor.canApprove} />
  ) : desk ? (
    <span className="num" data-testid="arcade-meta">
      {views.length} deals · {counts.live} live · {counts.soldOut} sold out · {counts.pending} at the rope
      {t !== null ? ` · replay ${formatClock(t)}` : ''}
    </span>
  ) : (
    <span>Lighting the windows…</span>
  );

  const stage =
    state.error && !desk ? (
      <StageMessage icon={<RotateCcw />} title="The arcade did not load" action={<Button onClick={() => void state.reload()}>Retry</Button>}>
        {state.error.message}
      </StageMessage>
    ) : !desk ? (
      <StageMessage icon={<Spinner small />} title="Lighting the windows">
        Reading deals, sales and approvals.
      </StageMessage>
    ) : (
      <>
        <ArcadeScene
          views={views}
          lens={lens}
          focusId={focus}
          isDim={isDim}
          onPick={pick}
          day={desk.day}
          now={now}
          t={desk.t}
          bars={bars}
          onScrub={scrub}
          pan={!desktop}
          replaying={playing}
        />
        {views.length === 0 && (
          <StageMessage icon={<ShoppingBag />} title="The arcade is dark" action={<LinkButton to="/shopfront" variant="primary">Open a shopfront</LinkButton>}>
            No deals run in this event yet. Every deal you plan lights a window here.
          </StageMessage>
        )}
      </>
    );

  return (
    <>
      <StagePage
        label="The midnight arcade"
        view={view}
        background="var(--db-sky-mid)"
        className={view === 'stage' ? 'db-sky' : undefined}
        title={focused ? focused.deal.name : 'The midnight arcade'}
        meta={meta}
        topRight={
          <>
            <form
              className="relative"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                fly();
              }}
            >
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-[1] size-4 -translate-y-1/2 text-faint" />
              <label htmlFor="db-find" className="sr-only">
                Find a deal
              </label>
              <Input
                ref={findRef}
                id="db-find"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a deal…"
                list="db-find-list"
                className={view === 'stage' ? 'x-glass w-40 rounded-full! pl-8' : 'w-40 pl-8'}
              />
              <datalist id="db-find-list">
                {views.map((v) => (
                  <option key={v.deal.id} value={v.deal.name} />
                ))}
              </datalist>
            </form>
            {view === 'stage' && (
              <Button
                size="sm"
                icon={playing ? <Pause /> : <Play />}
                onClick={() => setPlaying((p) => !p)}
                className="x-glass h-8 rounded-full! ring-0"
                aria-pressed={playing}
                data-testid="replay"
              >
                {playing ? 'Pause' : t !== null ? 'Resume' : 'Replay the day'}
              </Button>
            )}
            {t !== null && !playing && view === 'stage' && (
              <Button size="sm" onClick={() => setT(null)} className="x-glass h-8 rounded-full! ring-0" data-testid="back-to-live">
                Live
              </Button>
            )}
            {desktop && <IconButton label="Keyboard shortcuts" icon={<Keyboard />} onClick={() => setHelp(true)} variant="ghost" className={view === 'stage' ? 'x-glass rounded-full!' : undefined} />}
            <ViewToggle value={view} onChange={setView} glass={view === 'stage'} stageLabel="Arcade" listLabel="List" stageIcon={<Store />} />
          </>
        }
        lenses={<LensBar lenses={LENSES} value={lens} onChange={setLens} showLabel={false} />}
        legend={desk && <Legend title={LENS_LABEL[lens]} items={legendFor(views, lens)} collapsible defaultOpen={desktop} />}
        bottomRight={desktop ? undefined : viewAsSwitch}
        side={
          <div>
            {desktop && <div className="mb-3 px-1">{viewAsSwitch}</div>}
            <TodayPanel
              bare
              items={today}
              date={new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(now)}
              activeId={entries.find((e) => e.dealId === focus)?.id ?? null}
              empty={role === 'approver' ? 'Nobody waits at the velvet rope.' : 'Every window is in order.'}
              onSelect={(it) => {
                const e = entries.find((x) => x.id === it.id);
                if (!e) return;
                setPlaying(false);
                setT(null);
                setFocus(e.dealId);
                setLens(e.lens);
                setView('stage');
              }}
            />
          </div>
        }
        sideCount={today.length}
        stage={stage}
        list={desk ? <ArcadeList views={views} lens={lens} focus={focus} me={actor.sub} now={now} /> : null}
      />
      <ShortcutSheet open={help} onClose={() => setHelp(false)} />
    </>
  );
}

function FocusMeta({ v, me, canApprove }: { v: DealView; me: string; canApprove: boolean }) {
  const mine = v.deal.ownerSub === me;
  const action =
    v.status === 'pending' && canApprove && !mine
      ? { to: `/rope/${v.deal.id}`, label: 'Velvet rope', icon: <Wand2 /> }
      : mine && (v.status === 'draft' || v.status === 'pending' || v.status === 'approved' || v.status === 'live')
        ? { to: `/shopfront/${v.deal.id}`, label: 'Edit in Shopfront', icon: <Store /> }
        : null;
  const showForecast = v.status === 'live' || v.soldOut || v.status === 'approved';
  return (
    <>
      <StatusBadge v={v} />
      <span className="text-xs">{CATEGORY_LABEL[v.deal.category]}</span>
      <span className="font-mono text-xs num">
        {money(v.deal.dealPrice)} −{pct0(v.discount)}
      </span>
      <span className="font-mono text-xs num" data-testid="focus-facts">
        {v.sold.toLocaleString()}/{v.deal.stockUnits.toLocaleString()} sold · {pct1(v.margin)}
      </span>
      {showForecast && (
        <span data-testid="focus-forecast" className={v.forecast.kind === 'early' ? 'w-full text-ui font-medium text-warn-text' : 'w-full text-ui text-muted'}>
          {forecastText(v.forecast, v.deal.endsAt)}
        </span>
      )}
      <span className="flex w-full flex-wrap gap-2 pt-1">
        {action && (
          <LinkButton to={action.to} size="sm" variant="primary" icon={action.icon} data-testid="focus-action">
            {action.label}
          </LinkButton>
        )}
        <LinkButton to={`/ticker/${v.deal.id}`} size="sm" data-testid="focus-open">
          Ticker
        </LinkButton>
      </span>
    </>
  );
}

/* ------------------------------------------------------------------ list (same data) */

type SortKey = 'name' | 'status' | 'sell' | 'margin' | 'discount' | 'revenue' | 'forecast';

function sortValue(v: DealView, k: SortKey): number | string {
  switch (k) {
    case 'name':
      return v.deal.name.toLowerCase();
    case 'status':
      return v.label;
    case 'sell':
      return v.sellThrough;
    case 'margin':
      return v.margin;
    case 'discount':
      return v.discount;
    case 'revenue':
      return v.revenue;
    case 'forecast':
      return v.forecast.kind === 'early' || v.forecast.kind === 'lasts' ? toMs(v.forecast.at) : v.forecast.kind === 'soldOut' ? 0 : Number.MAX_SAFE_INTEGER;
  }
}

function ArcadeList({ views, lens, focus, me, now }: { views: DealView[]; lens: Lens; focus: string | null; me: string; now: number }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'sell', dir: -1 });
  const rows = [...views].sort((a, b) => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.deal.name.localeCompare(b.deal.name);
  });
  const head = (key: SortKey, label: string, numeric?: boolean) => (
    <Th numeric={numeric} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1 font-[inherit] text-inherit hover:text-fg"
        onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' || key === 'status' || key === 'forecast' ? 1 : -1 }))}
      >
        {label}
        <ArrowUpDown aria-hidden="true" className={sort.key === key ? 'size-3 text-fg' : 'size-3 text-faint'} />
      </button>
    </Th>
  );
  return (
    <>
      <TableWrap label="Deals in this event">
        <Table data-testid="arcade-list">
          <thead>
            <tr>
              {head('name', 'Deal')}
              {head('status', 'Status')}
              {head('sell', 'Sold')}
              {head('discount', 'Off', true)}
              {head('margin', 'Margin', true)}
              {head('revenue', 'Revenue', true)}
              {head('forecast', 'Forecast')}
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <Tr key={v.deal.id} selected={v.deal.id === focus} data-testid="deal-row" data-sku={v.deal.sku}>
                <Td>
                  <span className="flex min-w-[220px] items-center gap-3">
                    <PaneSwatch color={lensColor(v, lens)} dark={v.soldOut || v.status === 'ended'} />
                    <span className="min-w-0">
                      <Link to={`/ticker/${v.deal.id}`} className="block font-medium text-fg">
                        {v.deal.name}
                      </Link>
                      <span className="block font-mono text-xs text-muted">
                        {v.deal.sku} · {CATEGORY_LABEL[v.deal.category]} · {v.deal.ownerSub === me ? 'you' : v.deal.ownerName}
                        {lens !== 'sell' && lens !== 'category' ? ` · ${groupLabel(v, lens)}` : ''}
                      </span>
                    </span>
                  </span>
                </Td>
                <Td>
                  <StatusBadge v={v} />
                </Td>
                <Td>
                  <span className="flex flex-col gap-0.5">
                    <SellBar v={v} />
                    <span className="font-mono text-[11px] text-muted num">
                      {v.sold.toLocaleString()} / {v.deal.stockUnits.toLocaleString()}
                    </span>
                  </span>
                </Td>
                <Td numeric>{pct0(v.discount)}</Td>
                <Td numeric className={v.belowFloor ? 'text-bad-text' : undefined}>
                  {pct1(v.margin)}
                </Td>
                <Td numeric>{money(v.revenue, 0)}</Td>
                <Td muted className="min-w-[180px]">
                  {v.status === 'live' || v.soldOut || v.status === 'approved' ? (
                    <span className={v.forecast.kind === 'early' ? 'font-medium text-warn-text' : undefined}>{forecastText(v.forecast, v.deal.endsAt)}</span>
                  ) : v.status === 'pending' ? (
                    'Waits for approval'
                  ) : v.sentBack ? (
                    `Sent back: ${v.sentBack.note ?? ''}`
                  ) : v.status === 'draft' && v.belowFloor ? (
                    <span className="text-bad-text">Below the margin floor</span>
                  ) : (
                    '—'
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      <p className="mt-3 text-ui text-muted">
        Times are in your time zone. Live figures update every {rules.POLL_MS / 1000} seconds; {formatClock(now)} now.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ keyboard */

const KEYS: [string[], string][] = [
  [['1', '–', '5'], 'Lens: sell-through, margin, discount, sell-out risk, category'],
  [['V'], 'View as floor, merchandiser or approver'],
  [['L'], 'Arcade or list'],
  [['←', '→'], 'Step from window to window'],
  [['O'], 'Open the focused deal in the Ticker'],
  [['R'], 'Replay the day on the clock'],
  [['N'], 'New deal (Shopfront)'],
  [['/'], 'Find a deal'],
  [['Esc'], 'Back to live, then back to the whole arcade'],
  [['?'], 'This list'],
];

function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts">
      <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2.5 text-sm">
        {KEYS.map(([keys, what]) => (
          <div key={what} className="contents">
            <dt className="flex items-center gap-1">{keys.map((k) => (k === '–' ? <span key={k} className="text-faint">–</span> : <Kbd key={k}>{k}</Kbd>))}</dt>
            <dd className="m-0 text-muted">{what}</dd>
          </div>
        ))}
      </dl>
      <p className="mb-0 mt-4 text-ui text-muted">
        On the clock: <Kbd>←</Kbd> <Kbd>→</Kbd> 15 minutes, <Kbd>PgUp</Kbd> <Kbd>PgDn</Kbd> an hour, <Kbd>Home</Kbd> the first hour, <Kbd>End</Kbd> live.
      </p>
    </Dialog>
  );
}

