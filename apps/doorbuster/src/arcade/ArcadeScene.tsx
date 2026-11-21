/**
 * The midnight arcade (rich SVG): a two-floor shopping arcade under a glass fanlight, one storefront block per
 * category and one shop window per deal, with the arcade clock across the top. On phones the arcade pans sideways.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '@x10/shared/ui';

import { CATEGORY_LABEL } from '../model';
import { CATEGORY_COLOR, type DealView, type Lens } from '../domain/desk';
import { ArcadeClock, ClockDefs, PhoneClock } from './Clock';
import { CLOCK, FACADE_Y, FLOORS, layoutArcade, rand, SCENE_H, VIEW_Y0, type BlockGeom } from './layout';
import { EmptyWindow, ShopWindow } from './ShopWindow';

export interface ArcadeSceneProps {
  views: DealView[];
  lens: Lens;
  focusId: string | null;
  isDim: (v: DealView) => boolean;
  onPick: (id: string) => void;
  day: { from: number; to: number };
  now: number;
  t: number;
  bars: { t: number; units: number }[];
  onScrub: (t: number) => void;
  /** Phones: draw at the stage's height and pan sideways. */
  pan?: boolean;
  replaying?: boolean;
}

const FLAKES = 30;

function usePageHidden() {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
  useEffect(() => {
    const on = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return hidden;
}

export function ArcadeScene({ views, lens, focusId, isDim, onPick, day, now, t, bars, onScrub, pan, replaying }: ArcadeSceneProps) {
  const reduced = useReducedMotion();
  const hidden = usePageHidden();
  const layout = useMemo(() => layoutArcade(views, (v) => v.deal.category), [views]);
  const W = layout.width;
  const wrap = useRef<HTMLDivElement>(null);

  // Phones: bring the focused window into view.
  useEffect(() => {
    if (!pan || !focusId || !wrap.current) return;
    const slot = layout.windows.find((s) => s.item?.deal.id === focusId);
    const el = wrap.current;
    if (!slot) return;
    const scale = el.clientHeight / (SCENE_H - VIEW_Y0.phone);
    el.scrollTo({ left: (slot.x + slot.w / 2) * scale - el.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
  }, [focusId, pan, layout, reduced]);

  // Phones start centred on the arcade.
  useEffect(() => {
    if (!pan || !wrap.current) return;
    const el = wrap.current;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [pan]);

  const y0 = pan ? VIEW_Y0.phone : VIEW_Y0.desktop;
  const svg = (
    <svg
      viewBox={`0 ${y0} ${W} ${SCENE_H - y0}`}
      preserveAspectRatio="xMidYMin meet"
      className={pan ? 'block h-full overflow-visible' : 'absolute inset-y-0 left-0 h-full w-[calc(100%-var(--side-w,0px))] overflow-visible'}
      style={pan ? { aspectRatio: `${W} / ${SCENE_H - y0}`, width: 'auto' } : undefined}
      role="group"
      aria-label={`The midnight arcade: ${views.length} deals in ${new Set(views.map((v) => v.deal.category)).size} storefront blocks`}
      data-testid="arcade"
      data-lens={lens}
    >
      <Defs />
      <Fanlight width={W} />
      <Facade width={W} />
      {layout.blocks.map((b) => (
        <Block key={b.category} block={b} lens={lens} />
      ))}
      <Columns blocks={layout.blocks} />
      <Balcony width={W} />
      <Street width={W} />
      {!pan && (
        <ArcadeClock x0={CLOCK.x0 + (W - 1000) / 2} x1={W - 30 - (W - 1000) / 2} y={CLOCK.y} h={CLOCK.h} from={day.from} to={day.to} now={now} t={t} bars={bars} onScrub={onScrub} />
      )}

      {/* Windows, upper floor first so the balcony rail can sit in front of its queues. */}
      <g data-floor="upper">
        {layout.windows
          .filter((s) => s.floor === 0)
          .map((s) =>
            s.item ? (
              <ShopWindow key={s.item.deal.id} slot={s as never} view={s.item} lens={lens} focused={focusId === s.item.deal.id} dim={isDim(s.item)} onPick={onPick} />
            ) : (
              <EmptyWindow key={`empty-${s.category}`} slot={s} />
            ),
          )}
      </g>
      <Railing width={W} />
      <g data-floor="street">
        {layout.windows
          .filter((s) => s.floor === 1)
          .map((s) =>
            s.item ? (
              <ShopWindow key={s.item.deal.id} slot={s as never} view={s.item} lens={lens} focused={focusId === s.item.deal.id} dim={isDim(s.item)} onPick={onPick} />
            ) : (
              <EmptyWindow key={`empty-${s.category}`} slot={s} />
            ),
          )}
      </g>
      {!reduced && <Snow width={W} />}
    </svg>
  );

  return (
    <div className={[hidden ? 'db-paused' : '', replaying ? 'db-replaying' : '', 'absolute inset-0'].join(' ')}>
      {pan ? (
        <>
          <div ref={wrap} className="no-scrollbar absolute inset-0 overflow-x-auto overflow-y-hidden" data-testid="arcade-pan">
            {svg}
          </div>
          <PhoneClock from={day.from} to={day.to} now={now} t={t} bars={bars} onScrub={onScrub} />
        </>
      ) : (
        svg
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ the building */

function Defs() {
  return (
    <>
    <ClockDefs />
    <defs>
      <filter id="db-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3.2" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="db-blur-8" x="-50%" y="-200%" width="200%" height="500%">
        <feGaussianBlur stdDeviation="8" />
      </filter>
      <filter id="db-blur-3" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.4" />
      </filter>
      <radialGradient id="db-hot" cx="50%" cy="0%" r="90%">
        <stop offset="0%" stopColor="white" stopOpacity={0.55} />
        <stop offset="100%" stopColor="white" stopOpacity={0} />
      </radialGradient>
      <linearGradient id="db-beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--db-neon-white)" stopOpacity={0.32} />
        <stop offset="100%" stopColor="var(--db-neon-white)" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="db-reflect-fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="white" stopOpacity={0.9} />
        <stop offset="100%" stopColor="white" stopOpacity={0} />
      </linearGradient>
      <mask id="db-reflect-mask" maskContentUnits="objectBoundingBox">
        <rect x={0} y={0} width={1} height={1} fill="url(#db-reflect-fade)" />
        {[0.18, 0.36, 0.55, 0.74].map((y) => (
          <rect key={y} x={0} y={y} width={1} height={0.035} fill="black" />
        ))}
      </mask>
      <pattern id="db-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--db-clock-line)" strokeWidth="1.5" />
      </pattern>
      <linearGradient id="db-floor-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--db-street)" />
        <stop offset="100%" stopColor="var(--db-street-2)" />
      </linearGradient>
      <linearGradient id="db-facade-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--db-facade-2)" />
        <stop offset="100%" stopColor="var(--db-facade)" />
      </linearGradient>
    </defs>
    </>
  );
}

/** The glass fanlight over the arcade's entrance: radial iron glazing bars and concentric arcs. */
function Fanlight({ width }: { width: number }) {
  const cx = width / 2;
  const cy = FACADE_Y + 4;
  const R = width * 0.62;
  const arcs = [R, R * 0.86, R * 0.7, R * 0.52];
  const ribs = 26;
  return (
    <g aria-hidden="true">
      <path d={`M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy} Z`} fill="var(--db-fan)" />
      {arcs.map((r, i) => (
        <path key={r} d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke="var(--db-fan-line)" strokeWidth={i === 0 ? 3 : 1.2} />
      ))}
      {Array.from({ length: ribs + 1 }, (_, i) => {
        const a = Math.PI + (i / ribs) * Math.PI;
        return <line key={i} x1={cx + Math.cos(a) * R * 0.3} y1={cy + Math.sin(a) * R * 0.3} x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R} stroke="var(--db-fan-line)" strokeWidth={1} />;
      })}
      <path d={`M${cx - R * 0.3},${cy} A${R * 0.3},${R * 0.3} 0 0 1 ${cx + R * 0.3},${cy}`} fill="var(--db-fan)" stroke="var(--db-fan-line)" strokeWidth={2} />
    </g>
  );
}

/** The facade both floors are set in, carried past the edges so wide screens never see where it stops. */
function Facade({ width }: { width: number }) {
  return (
    <g aria-hidden="true">
      <rect x={-600} y={FACADE_Y} width={width + 1200} height={FLOORS[1].floorY - FACADE_Y} fill="url(#db-facade-grad)" />
      <rect x={-600} y={FACADE_Y} width={width + 1200} height={4} fill="var(--db-iron)" />
      {/* Masonry courses. */}
      {Array.from({ length: 22 }, (_, i) => (
        <line key={i} x1={-600} x2={width + 600} y1={FACADE_Y + 8 + i * 21} y2={FACADE_Y + 8 + i * 21} stroke="var(--db-facade-line)" />
      ))}
    </g>
  );
}

/** A storefront block: its fascia and the category's neon sign. */
function Block({ block, lens }: { block: BlockGeom<DealView>; lens: Lens }) {
  const g = FLOORS[block.floor];
  const color = lens === 'category' ? CATEGORY_COLOR[block.category] : 'var(--db-neon-volt)';
  const cx = block.x + block.w / 2;
  const label = CATEGORY_LABEL[block.category].toUpperCase();
  return (
    <g data-testid="block" data-category={block.category}>
      <rect x={block.x - 2} y={g.signY - 6} width={block.w + 4} height={g.signH + 6} rx={2} fill="var(--db-fascia)" />
      <rect x={block.x - 2} y={g.signY + g.signH - 3} width={block.w + 4} height={3} fill="var(--db-fascia-2)" />
      <rect x={block.x} y={g.winY - 8} width={block.w} height={g.winH + 12} fill="var(--db-facade-2)" opacity={0.6} />
      <text x={cx} y={g.signY + g.signH / 2 + 3} textAnchor="middle" fontSize={14} fontWeight={700} letterSpacing="0.34em" fill={color} filter="url(#db-glow)" style={{ opacity: 'var(--db-glow)' }} aria-hidden="true">
        {label}
      </text>
      <text x={cx} y={g.signY + g.signH / 2 + 3} textAnchor="middle" fontSize={14} fontWeight={700} letterSpacing="0.34em" fill="var(--db-neon-white)" stroke={color} strokeWidth={0.6}>
        {label}
      </text>
    </g>
  );
}

/** Cast-iron columns between the blocks, through both floors. */
function Columns({ blocks }: { blocks: BlockGeom<DealView>[] }) {
  const xs = new Set<number>();
  for (const f of [0, 1] as const) {
    const row = blocks.filter((b) => b.floor === f);
    row.forEach((b, i) => {
      if (i === 0) xs.add(Math.round(b.x - 9));
      xs.add(Math.round(b.x + b.w + 9));
    });
  }
  return (
    <g aria-hidden="true">
      {[...xs].map((x) => (
        <g key={x}>
          <rect x={x - 4} y={FACADE_Y + 2} width={8} height={FLOORS[1].floorY - FACADE_Y - 2} fill="var(--db-iron)" />
          <rect x={x - 1} y={FACADE_Y + 2} width={2} height={FLOORS[1].floorY - FACADE_Y - 2} fill="var(--db-iron-2)" opacity={0.6} />
          <rect x={x - 7} y={FLOORS[0].signY - 8} width={14} height={5} rx={1} fill="var(--db-iron-2)" />
          <rect x={x - 7} y={FLOORS[1].signY - 8} width={14} height={5} rx={1} fill="var(--db-iron-2)" />
          <rect x={x - 6} y={FLOORS[1].floorY - 6} width={12} height={6} fill="var(--db-iron-2)" />
        </g>
      ))}
    </g>
  );
}

/** The upper gallery's walkway, carried on the slab over the street-level fascia. */
function Balcony({ width }: { width: number }) {
  const y = FLOORS[0].floorY;
  return (
    <g aria-hidden="true">
      <rect x={-600} y={y} width={width + 1200} height={FLOORS[1].signY - 6 - y} fill="var(--db-floor)" />
      <rect x={-600} y={y + 40} width={width + 1200} height={FLOORS[1].signY - 6 - y - 40} fill="var(--db-floor-2)" />
    </g>
  );
}

function Railing({ width }: { width: number }) {
  const top = FLOORS[0].feetY - 16;
  const bottom = FLOORS[0].feetY + 8;
  const n = Math.ceil((width + 1200) / 9);
  return (
    <g aria-hidden="true">
      <rect x={-600} y={top} width={width + 1200} height={2.5} rx={1} fill="var(--db-rail)" />
      <rect x={-600} y={bottom - 2} width={width + 1200} height={3} fill="var(--db-rail)" />
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={-600 + i * 9} y={top + 2} width={1.6} height={bottom - top - 3} fill="var(--db-rail)" />
      ))}
    </g>
  );
}

/** The street: wet paving that holds the windows' reflections. */
function Street({ width }: { width: number }) {
  const y = FLOORS[1].floorY;
  return (
    <g aria-hidden="true">
      <rect x={-600} y={y} width={width + 1200} height={SCENE_H - y + 400} fill="url(#db-floor-grad)" />
      <rect x={-600} y={y} width={width + 1200} height={2} fill="var(--db-iron)" />
      {Array.from({ length: 5 }, (_, i) => (
        <line key={i} x1={-600} x2={width + 600} y1={y + 18 + i * i * 6} y2={y + 18 + i * i * 6} stroke="var(--db-facade-line)" />
      ))}
    </g>
  );
}

function Snow({ width }: { width: number }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: FLAKES }, (_, i) => ({
        x: rand(`flake-x-${i}`) * width,
        r: 0.8 + rand(`flake-r-${i}`) * 1.5,
        dur: 12 + rand(`flake-d-${i}`) * 14,
        delay: -rand(`flake-t-${i}`) * 26,
        drift: (rand(`flake-w-${i}`) - 0.5) * 60,
      })),
    [width],
  );
  return (
    <g aria-hidden="true" pointerEvents="none" data-testid="snow">
      {flakes.map((f, i) => (
        <g key={i} className="db-flake" style={{ ['--dur' as string]: `${f.dur}s`, ['--delay' as string]: `${f.delay}s`, ['--drift' as string]: `${f.drift}px` }}>
          <circle cx={f.x} cy={FACADE_Y - 30} r={f.r} fill="var(--db-snow)" />
        </g>
      ))}
    </g>
  );
}
