/**
 * The arcade clock: the event's 24 hours along the top, with every 15 minutes of sales drawn as a bar. Drag it (or use
 * the arrow keys) to replay the day from the sales ticks; the windows show the moment under the playhead.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { HOUR, MINUTE } from '@x10/shared/lib';

import { formatClock } from '../domain/desk';

const MONO = { fontFamily: 'var(--mono)' } as const;

export interface ClockProps {
  /** Left and right edges and top, in the parent SVG's units. */
  x0: number;
  x1: number;
  y: number;
  h?: number;
  from: number;
  to: number;
  now: number;
  t: number;
  /** Units sold in each 15-minute bucket ending at `t`, across all deals. */
  bars: { t: number; units: number }[];
  onScrub: (t: number) => void;
}

const hourLabel = (ms: number) => new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(ms);

export function ArcadeClock({ x0, x1, y, h = 46, from, to, now, t, bars, onScrub }: ClockProps) {
  const ref = useRef<SVGRectElement>(null);
  const tx0 = x0 + 100;
  const tx1 = x1 - 16;
  const base = y + h - 15;
  const top = y + 8;
  const span = to - from;
  const px = (v: number) => tx0 + ((v - from) / span) * (tx1 - tx0);
  const max = Math.max(1, ...bars.map((b) => b.units));
  const live = now - t < MINUTE;
  const bw = ((tx1 - tx0) / (span / (15 * MINUTE))) * 0.72;

  const clamp = (v: number) => Math.min(now, Math.max(from, v));
  const snap = (v: number) => Math.round(v / (5 * MINUTE)) * 5 * MINUTE;
  const fromPointer = (e: PointerEvent) => {
    const el = ref.current;
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const v = from + ((p.x - tx0) / (tx1 - tx0)) * span;
    onScrub(v >= now - 5 * MINUTE ? now : clamp(snap(v)));
  };
  const onKey = (e: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -15 * MINUTE, ArrowRight: 15 * MINUTE, PageDown: -HOUR, PageUp: HOUR };
    if (e.key in step) {
      e.preventDefault();
      e.stopPropagation();
      const v = clamp(snap(t) + step[e.key]);
      onScrub(v >= now - 5 * MINUTE ? now : v);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      onScrub(e.key === 'Home' ? from : now);
    }
  };

  const hours = Array.from({ length: Math.round(span / HOUR) + 1 }, (_, i) => from + i * HOUR);
  // Hour labels every 3 h when there is room, every 6 h on a phone-sized strip.
  const every = tx1 - tx0 < 320 ? 6 : 3;

  return (
    <g data-testid="arcade-clock" data-live={live}>
      <rect x={x0} y={y} width={x1 - x0} height={h} rx={12} fill="var(--db-clock)" stroke="var(--db-clock-line)" />
      {/* The time under the playhead, and whether it is live or a replay. */}
      <text x={x0 + 16} y={y + 22} fontSize={17} fontWeight={700} fill="var(--db-clock-ink)" style={MONO} data-testid="clock-time">
        {formatClock(t)}
      </text>
      <circle cx={x0 + 19.5} cy={y + 33.5} r={2.6} fill={live ? 'var(--db-neon-ok)' : 'var(--db-neon-warn)'} />
      <text x={x0 + 27} y={y + 36.5} fontSize={8.5} fontWeight={700} letterSpacing="0.16em" fill={live ? 'var(--db-neon-ok)' : 'var(--db-neon-warn)'}>
        {live ? 'LIVE' : 'REPLAY'}
      </text>
      <line x1={tx0 - 12} x2={tx0 - 12} y1={y + 9} y2={y + h - 9} stroke="var(--db-clock-line)" />

      {/* Future: not sold yet. */}
      <rect x={px(now)} y={top} width={Math.max(0, tx1 - px(now))} height={base - top} fill="url(#db-hatch-c)" opacity={0.5} />
      <line x1={px(now)} x2={tx1} y1={base} y2={base} stroke="var(--db-clock-muted)" strokeDasharray="2 3" opacity={0.6} />
      <line x1={tx0} x2={px(now)} y1={base} y2={base} stroke="var(--db-clock-line)" />

      {/* Units sold per 15 minutes, brighter up to the playhead. */}
      <g data-testid="clock-bars" filter="url(#db-glow-soft)">
        {bars.map((b) => {
          const bh = Math.max(b.units ? 1.5 : 0, (b.units / max) * (base - top - 4));
          return (
            <rect
              key={b.t}
              x={px(b.t) - bw}
              y={base - bh}
              width={bw}
              height={bh}
              rx={0.8}
              fill="var(--db-neon-volt)"
              opacity={b.t <= t ? 0.95 : 0.28}
            />
          );
        })}
      </g>

      {/* Hours. */}
      {hours.map((hh, i) => (
        <g key={hh} aria-hidden="true">
          <line x1={px(hh)} x2={px(hh)} y1={base + 1} y2={base + (i % 3 === 0 ? 5 : 3)} stroke="var(--db-clock-muted)" opacity={0.7} />
          {i % every === 0 && i < hours.length - 1 && (
            <text x={px(hh)} y={y + h - 3.5} textAnchor={i === 0 ? 'start' : 'middle'} fontSize={8} fill="var(--db-clock-muted)" style={MONO}>
              {hourLabel(hh)}
            </text>
          )}
        </g>
      ))}
      {tx1 - tx0 >= 320 && (
        <text x={px(now) + 4} y={top + 7} fontSize={7.5} fontWeight={700} letterSpacing="0.14em" fill="var(--db-clock-muted)">
          NOW
        </text>
      )}

      {/* Playhead. */}
      <g pointerEvents="none">
        <line x1={px(t)} x2={px(t)} y1={top - 2} y2={base + 2} stroke="var(--db-neon-white)" strokeWidth={1.5} filter="url(#db-glow-soft)" />
        <circle className="db-clock-knob" cx={px(t)} cy={top - 2} r={4} fill="var(--db-neon-white)" stroke="var(--db-neon-volt)" strokeWidth={1.5} />
      </g>

      <rect
        ref={ref}
        className="db-clock-hit"
        x={tx0 - 6}
        y={y}
        width={tx1 - tx0 + 12}
        height={h}
        fill="transparent"
        role="slider"
        tabIndex={0}
        aria-label="Arcade clock: replay the day"
        aria-valuemin={from}
        aria-valuemax={now}
        aria-valuenow={t}
        aria-valuetext={`${formatClock(t)}${live ? ', live' : ', replay'}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) fromPointer(e);
        }}
        data-testid="clock-slider"
      />
    </g>
  );
}

/** Phones: the clock as its own strip over the top of the stage, sized to its box (the arcade pans beneath it). */
export function PhoneClock(props: Omit<ClockProps, 'x0' | 'x1' | 'y' | 'h'>) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(300);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(200, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="pointer-events-auto absolute left-3 right-[104px] top-3 z-[5] h-[46px]">
      <svg viewBox={`0 0 ${w} 46`} width={w} height={46} className="block overflow-visible">
        <ClockDefs />
        <ArcadeClock {...props} x0={0} x1={w} y={0} h={46} />
      </svg>
    </div>
  );
}

/** Filters the clock needs (also when it is drawn outside the arcade's own SVG). */
export function ClockDefs() {
  return (
    <defs>
      <filter id="db-glow-soft" x="-20%" y="-60%" width="140%" height="220%">
        <feGaussianBlur stdDeviation="1.4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <pattern id="db-hatch-c" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--db-clock-line)" strokeWidth="1.5" />
      </pattern>
    </defs>
  );
}
