/**
 * Small shared pieces for the deal desk's screens: status as a dot and a label, a sell-through bar, a deal's
 * window swatch, and a compact sparkline with the sell-out projection.
 */
import { toMs } from '@x10/shared/lib';
import { Badge, cx } from '@x10/shared/ui';

import { money, pct0 } from '../config';
import type { DealView } from '../domain/desk';
import { cumulativeSeries } from '../domain/forecast';

export function StatusBadge({ v, className }: { v: Pick<DealView, 'label' | 'tone'>; className?: string }) {
  return (
    <Badge tone={v.tone} className={className}>
      {v.label}
    </Badge>
  );
}

/** Units sold against stock, with the target marked. */
export function SellBar({ v, color = 'var(--accent-9)', width = 96 }: { v: DealView; color?: string; width?: number }) {
  const target = Math.min(1, v.deal.targetUnits / Math.max(1, v.deal.stockUnits));
  return (
    <span className="inline-flex items-center gap-2" title={`${v.sold} of ${v.deal.stockUnits} sold · target ${v.deal.targetUnits}`}>
      <span className="relative inline-block h-1.5 rounded-full bg-gray-4" style={{ width }} aria-hidden="true">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v.sellThrough * 100}%`, background: v.soldOut ? 'var(--bad-solid)' : color }} />
        <span className="absolute -top-0.5 h-2.5 w-px bg-gray-10" style={{ left: `${target * 100}%` }} />
      </span>
      <span className="font-mono text-xs text-muted num">{pct0(v.sellThrough)}</span>
    </span>
  );
}

/** A tiny lit pane in the deal's lens colour, so a table row can be matched to its window. */
export function PaneSwatch({ color, dark, className }: { color: string; dark?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-block h-4 w-3 shrink-0 rounded-[3px] ring-1 ring-inset ring-black/10', className)}
      style={{ background: dark ? 'var(--gray-12)' : `linear-gradient(180deg, color-mix(in oklab, ${color} 92%, white), ${color})` }}
    />
  );
}

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cx('font-mono num', className)}>{money(value)}</span>;
}

/**
 * Cumulative units over the deal's window with the stock line, and (while live) the projection from now at the
 * recent rate, dashed, to where it meets stock or the end.
 */
export function Sparkline({ v, now, width = 120, height = 32, color = 'var(--accent-9)', className }: { v: DealView; now: number; width?: number; height?: number; color?: string; className?: string }) {
  const from = toMs(v.deal.startsAt);
  const to = toMs(v.deal.endsAt);
  const span = Math.max(1, to - from);
  const until = Math.min(now, to);
  const stock = Math.max(1, v.deal.stockUnits);
  const pts = until > from ? cumulativeSeries(v.ticks, from, until, Math.max(span / 48, 60_000)) : [];
  const px = (t: number) => ((t - from) / span) * width;
  const py = (u: number) => height - 2 - (Math.min(u, stock) / stock) * (height - 4);
  const line = [`M0,${py(0)}`, ...pts.map((p) => `L${px(p.t).toFixed(1)},${py(p.sold).toFixed(1)}`)].join(' ');
  const f = v.forecast;
  const proj =
    v.status === 'live' && (f.kind === 'early' || f.kind === 'lasts')
      ? { x1: px(Math.min(toMs(f.at), to)), y1: py(f.kind === 'early' ? stock : f.projectedUnits) }
      : null;
  const last = pts.at(-1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cx('overflow-visible', className)} aria-hidden="true">
      <line x1={0} x2={width} y1={py(stock)} y2={py(stock)} stroke="var(--gray-7)" strokeDasharray="2 2" />
      <line x1={0} x2={width} y1={py(v.deal.targetUnits)} y2={py(v.deal.targetUnits)} stroke="var(--gray-6)" />
      <path d={line} fill="none" stroke={v.soldOut ? 'var(--bad-solid)' : color} strokeWidth={1.6} strokeLinejoin="round" />
      {proj && last && <line x1={px(last.t)} y1={py(last.sold)} x2={proj.x1} y2={proj.y1} stroke={f.kind === 'early' ? 'var(--warn-solid)' : color} strokeWidth={1.4} strokeDasharray="3 2" />}
      {proj && f.kind === 'early' && <circle cx={proj.x1} cy={proj.y1} r={2.4} fill="var(--warn-solid)" />}
    </svg>
  );
}
