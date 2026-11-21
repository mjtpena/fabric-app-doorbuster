/**
 * A deal's sales over its window: cumulative units against the stock and target lines, and (while live) the
 * projection at the recent rate, dashed, to the moment stock runs out or the deal ends.
 */
import { useEffect, useRef, useState } from 'react';
import { HOUR, toMs } from '@x10/shared/lib';

import { formatClock, type DealView } from '../domain/desk';
import { cumulativeSeries } from '../domain/forecast';

const hourLabel = (ms: number) => new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(ms);

export function SalesChart({ v, now }: { v: DealView; now: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 500 ? 200 : 260;
  const L = 44;
  const R = 16;
  const T = 28;
  const B = 28;
  const from = toMs(v.deal.startsAt);
  const to = toMs(v.deal.endsAt);
  const span = Math.max(HOUR, to - from);
  const stock = Math.max(1, v.deal.stockUnits);
  const until = Math.min(now, to);
  const pts = until > from ? cumulativeSeries(v.ticks, from, until, Math.max(span / 96, 60_000)) : [];
  const x = (t: number) => L + ((t - from) / span) * (W - L - R);
  const y = (u: number) => T + (1 - Math.min(u, stock) / stock) * (H - T - B);
  const path = [`M${x(from)},${y(0)}`, ...pts.map((p) => `L${x(p.t).toFixed(1)},${y(p.sold).toFixed(1)}`)].join(' ');
  const area = pts.length ? `${path} L${x(pts.at(-1)!.t).toFixed(1)},${y(0)} Z` : '';
  const f = v.forecast;
  const last = pts.at(-1);
  const proj = v.status === 'live' && last && (f.kind === 'early' || f.kind === 'lasts') ? { t: Math.min(toMs(f.at), to), u: f.kind === 'early' ? stock : f.projectedUnits } : null;
  const step = (span > 18 * HOUR ? 3 * HOUR : span > 8 * HOUR ? 2 * HOUR : HOUR) * (W < 500 ? 2 : 1);
  const ticks: number[] = [];
  for (let t = Math.ceil(from / step) * step; t <= to; t += step) ticks.push(t);
  const color = v.soldOut ? 'var(--bad-solid)' : 'var(--accent-9)';

  return (
    <div ref={box} className="w-full">
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block" role="img" aria-label={`Units sold over the deal: ${v.sold} of ${v.deal.stockUnits}${proj ? `, projected ${f.kind === 'early' ? 'to sell out' : 'to reach ' + proj.u} by ${formatClock(proj.t)}` : ''}`} data-testid="sales-chart">
      <defs>
        <linearGradient id="db-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((k) => (
        <g key={k}>
          <line x1={L} x2={W - R} y1={y(stock * k)} y2={y(stock * k)} stroke="var(--line)" />
          <text x={L - 8} y={y(stock * k) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted, var(--gray-11))" style={{ fontFamily: 'var(--mono)' }}>
            {Math.round(stock * k)}
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={H - B} y2={H - B + 4} stroke="var(--line-strong)" />
          <text x={x(t)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--gray-11)" style={{ fontFamily: 'var(--mono)' }}>
            {hourLabel(t)}
          </text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={y(v.deal.targetUnits)} y2={y(v.deal.targetUnits)} stroke="var(--gray-9)" strokeDasharray="1 3" />
      <text x={W - R} y={y(v.deal.targetUnits) - 5} textAnchor="end" fontSize={10.5} fill="var(--gray-11)">
        target {v.deal.targetUnits}
      </text>
      <text x={W - R} y={y(stock) - 5} textAnchor="end" fontSize={10.5} fill="var(--gray-11)">
        stock {stock}
      </text>
      {now > from && now < to && <line x1={x(now)} x2={x(now)} y1={T} y2={H - B} stroke="var(--gray-8)" strokeDasharray="2 3" />}
      {area && <path d={area} fill="url(#db-chart-fill)" />}
      <path d={path} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      {proj && last && (
        <g data-testid="projection">
          <line x1={x(last.t)} y1={y(last.sold)} x2={x(proj.t)} y2={y(proj.u)} stroke={f.kind === 'early' ? 'var(--warn-solid)' : color} strokeWidth={2} strokeDasharray="5 4" />
          <circle cx={x(proj.t)} cy={y(proj.u)} r={4.5} fill={f.kind === 'early' ? 'var(--warn-solid)' : color} />
          <text x={x(proj.t)} y={y(proj.u) - 10} textAnchor={x(proj.t) > W - 90 ? 'end' : 'middle'} fontSize={11.5} fontWeight={600} fill={f.kind === 'early' ? 'var(--warn-text)' : 'var(--gray-12)'} style={{ fontFamily: 'var(--mono)' }}>
            {f.kind === 'early' ? `out ~${formatClock(proj.t)}` : `~${proj.u}`}
          </text>
        </g>
      )}
      {v.soldOut && v.soldOutAt && (
        <g>
          <circle cx={x(toMs(v.soldOutAt))} cy={y(stock)} r={4.5} fill="var(--bad-solid)" />
          <text x={x(toMs(v.soldOutAt)) + 8} y={y(stock) + 14} fontSize={11.5} fontWeight={600} fill="var(--bad-text)">
            sold out {formatClock(toMs(v.soldOutAt))}
          </text>
        </g>
      )}
    </svg>
    </div>
  );
}
