/**
 * One shop window: one deal. Brightness is sell-through; the neon tag is the discount; the queue outside is the last
 * hour's sales; sold out goes dark under a SOLD OUT neon that strikes once; an early sell-out lowers an amber shutter
 * that blinks; a deal waiting for approval stands behind a velvet rope; a draft is papered over.
 */
import { memo, type KeyboardEvent } from 'react';
import { toMs } from '@x10/shared/lib';

import { pct0 } from '../config';
import { formatClock, groupLabel, lensColor, LENS_LABEL, type DealView, type Lens } from '../domain/desk';
import { formatMargin, FLOOR_LABEL } from '../domain/pricing';
import { Goods, Paper, Shopper, Shutter, VelvetRope, Whitewash, goodsKind } from './art';
import { FLOORS, type WindowSlot } from './layout';

export type WinState = 'draft' | 'sentback' | 'pending' | 'scheduled' | 'live' | 'soldout' | 'ended' | 'cancelled';

export function windowState(v: DealView): WinState {
  if (v.soldOut) return 'soldout';
  if (v.sentBack) return 'sentback';
  switch (v.status) {
    case 'draft':
      return 'draft';
    case 'pending':
      return 'pending';
    case 'approved':
      return 'scheduled';
    case 'live':
      return 'live';
    case 'ended':
      return 'ended';
    case 'cancelled':
      return 'cancelled';
  }
}

/** How much light the window gives: sell-through for a live deal, a preview glow otherwise. */
export function lightLevel(v: DealView, s: WinState): number {
  if (s === 'live') return 0.14 + 0.86 * Math.pow(v.sellThrough, 0.85);
  if (s === 'pending') return 0.2;
  if (s === 'scheduled') return 0.13;
  return 0;
}

function shortName(name: string, w: number): string {
  const max = Math.max(6, Math.floor((w - 8) / 5.3));
  return name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name;
}

const MONO = { fontFamily: 'var(--mono)' } as const;

interface Props {
  slot: WindowSlot<DealView>;
  view: DealView;
  lens: Lens;
  focused: boolean;
  dim: boolean;
  onPick: (id: string) => void;
}

function ShopWindowImpl({ slot, view: v, lens, focused, dim, onPick }: Props) {
  const { x, y, w, h, floor } = slot;
  const g = FLOORS[floor];
  const id = v.deal.id;
  const s = windowState(v);
  const color = lensColor(v, lens);
  const level = lightLevel(v, s);
  const kind = goodsKind(v.deal.name, v.deal.category, v.deal.sku);
  const cx = x + w / 2;
  const sillY = y + h;
  const early = s === 'live' && v.forecast.kind === 'early';
  const discount = `−${pct0(v.discount)}`;
  const label = `${v.deal.name}. ${v.label}. ${pct0(v.sellThrough)} sold, ${v.sold} of ${v.deal.stockUnits}. ${pct0(v.discount)} off. ${LENS_LABEL[lens]}: ${groupLabel(v, lens)}.${early ? ' Sells out before it ends.' : ''}`;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onPick(id);
    }
  };

  return (
    <g
      className="db-window db-dim"
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={focused}
      onClick={() => onPick(id)}
      onKeyDown={onKey}
      opacity={dim ? 0.24 : 1}
      data-testid="window"
      data-sku={v.deal.sku}
      data-state={s}
      data-risk={v.risk}
      data-lens-color={color}
    >
      <title>{v.deal.name}</title>
      <defs>
        <radialGradient id={`db-l-${id}`} cx="50%" cy="22%" r="85%">
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset="55%" stopColor={color} stopOpacity={0.55} />
          <stop offset="100%" stopColor={color} stopOpacity={0.12} />
        </radialGradient>
      </defs>

      {/* Light spilling onto the floor in front, and (street level) its reflection on the wet paving. */}
      {level > 0 && (
        <ellipse
          className="db-light"
          cx={cx}
          cy={g.floorY + 10}
          rx={w * 0.62}
          ry={floor ? 18 : 10}
          fill={color}
          style={{ opacity: `calc(${level} * var(--db-pool))` }}
          filter="url(#db-blur-8)"
        />
      )}
      {floor === 1 && level > 0 && (
        <rect
          className="db-light"
          x={x + 6}
          y={g.floorY + 2}
          width={w - 12}
          height={h * 0.55}
          fill={`url(#db-l-${id})`}
          mask="url(#db-reflect-mask)"
          style={{ opacity: `calc(${level} * var(--db-reflect))` }}
          filter="url(#db-blur-3)"
        />
      )}

      {/* Halo: the window's light on the facade around it. */}
      {level > 0 && (
        <rect
          className="db-light"
          x={x - 10}
          y={y - 8}
          width={w + 20}
          height={h + 14}
          rx={8}
          fill={color}
          filter="url(#db-blur-8)"
          style={{ opacity: `calc(${level} * 0.45 * var(--db-glow))` }}
        />
      )}
      {/* Frame and glass. */}
      <rect x={x - 4} y={y - 5} width={w + 8} height={h + 9} rx={2} fill="var(--db-frame)" />
      <rect x={x} y={y} width={w} height={h} fill="var(--db-glass-dark)" />
      {level > 0 && <rect className="db-light" x={x} y={y} width={w} height={h} fill={`url(#db-l-${id})`} opacity={level} />}
      {level > 0.5 && <rect className="db-light" x={x} y={y} width={w} height={h * 0.5} fill="url(#db-hot)" opacity={(level - 0.5) * 1.6} />}

      {/* The goods, backlit. */}
      {s !== 'draft' && s !== 'sentback' && s !== 'cancelled' && (
        <g opacity={s === 'soldout' || s === 'ended' ? 0.45 : 1}>
          <Goods kind={kind} x={x} y={y} w={w} h={h} sku={v.deal.sku} fill="var(--db-glass-deep)" rim={level > 0 ? color : 'var(--db-frame)'} />
        </g>
      )}

      {/* Neon price tag in the window: lit while the deal can sell, a cold tube before it opens. */}
      {(s === 'live' || s === 'pending' || s === 'scheduled') && (
        <g aria-hidden="true">
          {s !== 'scheduled' && (
            <text x={cx} y={y + 30} textAnchor="middle" fontSize={20} fontWeight={700} fill={color} filter="url(#db-glow)" style={{ ...MONO, opacity: s === 'pending' ? 0.45 : 'var(--db-glow)' }}>
              {discount}
            </text>
          )}
          <text
            x={cx}
            y={y + 30}
            textAnchor="middle"
            fontSize={20}
            fontWeight={700}
            fill={s === 'scheduled' ? 'none' : 'var(--db-neon-white)'}
            stroke={color}
            strokeWidth={s === 'scheduled' ? 1 : 0.8}
            opacity={s === 'pending' ? 0.75 : s === 'scheduled' ? 0.7 : 1}
            style={MONO}
            data-testid="price-tag"
          >
            {discount}
          </text>
        </g>
      )}

      {/* Sold out: the window goes dark and the neon strikes once. */}
      {s === 'soldout' && (
        <g className="db-flicker" data-testid="sold-out-sign">
          <rect x={x + 6} y={y + 34} width={w - 12} height={46} rx={6} fill="none" stroke="var(--db-neon-bad)" strokeWidth={1.4} filter="url(#db-glow)" />
          {['SOLD', 'OUT'].map((word, i) => (
            <g key={word}>
              <text x={cx} y={y + 54 + i * 19} textAnchor="middle" fontSize={17} fontWeight={800} letterSpacing="0.12em" fill="var(--db-neon-bad)" filter="url(#db-glow)" style={{ opacity: 'var(--db-glow)' }}>
                {word}
              </text>
              <text x={cx} y={y + 54 + i * 19} textAnchor="middle" fontSize={17} fontWeight={800} letterSpacing="0.12em" fill="var(--db-neon-white)" stroke="var(--db-neon-bad)" strokeWidth={0.7}>
                {word}
              </text>
            </g>
          ))}
          {v.soldOutAt && (
            <text x={cx} y={y + 96} textAnchor="middle" fontSize={9} fill="var(--db-sill-muted)" style={MONO}>
              at {formatClock(toMs(v.soldOutAt))}
            </text>
          )}
        </g>
      )}

      {/* Opens later: a hanging card. */}
      {s === 'scheduled' && (
        <g aria-hidden="true">
          <path d={`M${cx - 16},${y} L${cx - 12},${y + 44} M${cx + 16},${y} L${cx + 12},${y + 44}`} stroke="var(--db-sill-muted)" strokeWidth={0.6} />
          <rect x={cx - 26} y={y + 42} width={52} height={24} rx={3} fill="var(--db-sill)" stroke="var(--db-neon-info)" strokeWidth={0.8} />
          <text x={cx} y={y + 52} textAnchor="middle" fontSize={7} letterSpacing="0.14em" fill="var(--db-sill-muted)">
            OPENS
          </text>
          <text x={cx} y={y + 62} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--db-sill-ink)" style={MONO}>
            {formatClock(toMs(v.deal.startsAt))}
          </text>
        </g>
      )}

      {/* Draft or sent back: papered over. Below the floor: a red stencil with the margin. */}
      {(s === 'draft' || s === 'sentback') && (
        <g>
          <Paper x={x} y={y} w={w} h={h} k={v.deal.sku} />
          <text x={cx} y={y + 30} textAnchor="middle" fontSize={11} fontWeight={700} letterSpacing="0.2em" fill="var(--db-paper-ink)" opacity={0.8}>
            {s === 'sentback' ? 'SENT BACK' : 'DRAFT'}
          </text>
          {v.belowFloor && (
            <g data-testid="floor-stencil" transform={`rotate(-8 ${cx} ${y + h * 0.58})`}>
              <rect x={x + 8} y={y + h * 0.46} width={w - 16} height={34} rx={2} fill="none" stroke="var(--db-neon-bad)" strokeWidth={1.6} />
              <text x={cx} y={y + h * 0.46 + 15} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--db-neon-bad)" style={MONO}>
                {formatMargin(v.margin)}
              </text>
              <text x={cx} y={y + h * 0.46 + 27} textAnchor="middle" fontSize={7.5} fontWeight={700} letterSpacing="0.1em" fill="var(--db-neon-bad)">
                {`UNDER ${FLOOR_LABEL} FLOOR`}
              </text>
            </g>
          )}
        </g>
      )}

      {s === 'cancelled' && (
        <g>
          <Whitewash x={x} y={y} w={w} h={h} />
          <text x={cx} y={y + h / 2 + 4} textAnchor="middle" fontSize={9} fontWeight={700} letterSpacing="0.16em" fill="var(--db-ink-muted)">
            CANCELLED
          </text>
        </g>
      )}

      {/* Ended on time: shutter down. Selling out early: shutter part-way down, amber beacon blinking. */}
      {s === 'ended' && (
        <g>
          <Shutter x={x} y={y} w={w} h={h} drop={1} />
          <rect x={cx - 30} y={y + h / 2 - 10} width={60} height={20} rx={2} fill="var(--db-shutter-2)" />
          <text x={cx} y={y + h / 2 + 3.5} textAnchor="middle" fontSize={8.5} fontWeight={700} letterSpacing="0.1em" fill="var(--db-sill-muted)" style={MONO}>
            {`ENDED ${formatClock(toMs(v.deal.endsAt))}`}
          </text>
        </g>
      )}
      {early && v.forecast.kind === 'early' && (
        <g data-testid="amber-shutter">
          <Shutter x={x} y={y} w={w} h={h} drop={0.27} />
          <rect className="db-blink" x={x} y={y + h * 0.27 - 2} width={w} height={3} fill="var(--db-neon-warn)" filter="url(#db-glow)" />
          <text x={cx} y={y + h * 0.27 - 9} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--db-neon-warn)" style={MONO}>
            {`OUT ~${formatClock(toMs(v.forecast.at))}`}
          </text>
        </g>
      )}

      {/* A neon tube around a selling window, brighter as it sells. */}
      {s === 'live' && (
        <rect
          className="db-light"
          x={x - 2}
          y={y - 2}
          width={w + 4}
          height={h + 4}
          rx={3}
          fill="none"
          stroke={color}
          strokeWidth={1.3}
          filter="url(#db-glow)"
          opacity={0.35 + 0.65 * v.sellThrough}
        />
      )}
      {/* Glass sheen. */}
      <path d={`M${x},${y + h * 0.62} L${x + w * 0.5},${y} L${x + w * 0.7},${y} L${x},${y + h * 0.86} Z`} fill="white" opacity={0.035} pointerEvents="none" />

      {/* Sill plate: the name and a bar of units sold against stock, with the target marked. */}
      <rect x={x - 4} y={sillY + 4} width={w + 8} height={g.sillH - 2} fill="var(--db-sill)" />
      <text x={x + 1} y={sillY + 14} fontSize={9.5} fontWeight={600} fill="var(--db-sill-ink)">
        {shortName(v.deal.name, w)}
      </text>
      <rect x={x + 1} y={sillY + 18} width={w - 2} height={2.5} rx={1.25} fill="var(--db-frame)" />
      <rect className="db-light" x={x + 1} y={sillY + 18} width={Math.max(0, (w - 2) * v.sellThrough)} height={2.5} rx={1.25} fill={v.soldOut ? 'var(--db-neon-bad)' : color} />
      <rect x={x + 1 + (w - 2) * Math.min(1, v.deal.targetUnits / v.deal.stockUnits) - 0.5} y={sillY + 16.5} width={1} height={5.5} fill="var(--db-sill-muted)" />

      {/* The queue outside, one shopper per CROWD_UNITS_PER_SHOPPER units sold in the last hour. */}
      <g data-testid="queue" data-count={v.crowd}>
        {Array.from({ length: v.crowd }, (_, i) => (
          <Shopper key={i} index={i} fx={cx - ((v.crowd - 1) * 11) / 2 + i * 11} fy={g.feetY} k={`${v.deal.sku}:${i}`} fill="var(--db-shopper)" rim={color} />
        ))}
      </g>

      {s === 'pending' && <VelvetRope x={x} w={w} fy={g.feetY} />}

      {/* Focus: a spotlight from the roof and a neon outline. */}
      {focused && (
        <g pointerEvents="none" data-testid="spotlight">
          <path d={`M${cx - 14},${y - 70} L${cx + 14},${y - 70} L${x + w + 14},${g.feetY + 4} L${x - 14},${g.feetY + 4} Z`} fill="url(#db-beam)" />
          <rect x={x - 7} y={y - 8} width={w + 14} height={h + g.sillH + 12} rx={5} fill="none" stroke="var(--db-neon-white)" strokeWidth={1.6} filter="url(#db-glow)" />
        </g>
      )}
      <rect className="db-focus-ring" x={x - 8} y={y - 9} width={w + 16} height={h + g.sillH + 14} rx={6} fill="none" stroke="var(--focus, var(--accent-9))" strokeWidth={2} />
    </g>
  );
}

export const ShopWindow = memo(ShopWindowImpl);

/** A block with no deals keeps a "to let" window so the arcade's shape stays the same. */
export function EmptyWindow({ slot }: { slot: WindowSlot<unknown> }) {
  const { x, y, w, h } = slot;
  return (
    <g aria-hidden="true" data-testid="empty-window">
      <rect x={x - 4} y={y - 5} width={w + 8} height={h + 9} rx={2} fill="var(--db-frame)" />
      <Whitewash x={x} y={y} w={w} h={h} />
      <text x={x + w / 2} y={y + h / 2 + 3} textAnchor="middle" fontSize={9} fontWeight={700} letterSpacing="0.18em" fill="var(--db-ink-muted)">
        TO LET
      </text>
    </g>
  );
}
