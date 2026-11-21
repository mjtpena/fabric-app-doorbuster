/**
 * Procedural art for the arcade, all drawn in code and deterministic from the deal's data: the goods in a window
 * (picked from the deal's name and category, varied by its SKU), the shoppers in the queue, the velvet rope, the
 * shutter, kraft paper and whitewash.
 */
import type { ReactNode } from 'react';

import type { Category } from '../model';
import { hash, rand } from './layout';

type Kind =
  | 'tv'
  | 'laptop'
  | 'earbuds'
  | 'vacuum'
  | 'bedding'
  | 'pot'
  | 'lamp'
  | 'coat'
  | 'beanie'
  | 'shoes'
  | 'bust'
  | 'blocks'
  | 'car'
  | 'cube'
  | 'teddy'
  | 'bottles'
  | 'dryer'
  | 'kit'
  | 'coffee'
  | 'hamper'
  | 'oil'
  | 'crates';

const KEYWORDS: [RegExp, Kind][] = [
  [/\b(tv|television|monitor|screen)\b/i, 'tv'],
  [/laptop|notebook|tablet/i, 'laptop'],
  [/earbud|headphone|speaker|buds/i, 'earbuds'],
  [/vacuum/i, 'vacuum'],
  [/bedding|linen|duvet|towel|blanket/i, 'bedding'],
  [/casserole|pot|pan|dutch oven|kettle/i, 'pot'],
  [/lamp|light/i, 'lamp'],
  [/coat|jacket|parka|dress/i, 'coat'],
  [/beanie|hat|scarf|glove/i, 'beanie'],
  [/sneaker|shoe|boot/i, 'shoes'],
  [/building|blocks|bricks|lego/i, 'blocks'],
  [/racer|car|drone|truck/i, 'car'],
  [/cube|puzzle/i, 'cube'],
  [/teddy|plush|bear/i, 'teddy'],
  [/serum|cream|lotion|perfume|trio/i, 'bottles'],
  [/dryer|straightener|curler/i, 'dryer'],
  [/kit|set/i, 'kit'],
  [/coffee|tea|bean/i, 'coffee'],
  [/hamper|basket|gift box/i, 'hamper'],
  [/oil|wine|sauce|vinegar/i, 'oil'],
];

const FALLBACK: Record<Category, Kind[]> = {
  electronics: ['tv', 'laptop', 'earbuds'],
  home: ['lamp', 'pot', 'bedding', 'vacuum'],
  fashion: ['coat', 'bust', 'shoes', 'beanie'],
  toys: ['blocks', 'car', 'teddy', 'cube'],
  beauty: ['bottles', 'dryer', 'kit'],
  grocery: ['coffee', 'hamper', 'oil', 'crates'],
};

export function goodsKind(name: string, category: Category, sku: string): Kind {
  const fixed = KEYWORDS.find(([re]) => re.test(name))?.[1];
  if (fixed && (category !== 'toys' || fixed !== 'kit')) return fixed;
  const list = FALLBACK[category];
  return list[hash(sku) % list.length];
}

/**
 * The goods on display, as backlit silhouettes standing on the window's plinth. (x, y) is the glass's top-left;
 * w and h its size. `fill` is the silhouette colour, `rim` a thin highlight in the window's light.
 */
export function Goods({ kind, x, y, w, h, sku, fill, rim }: { kind: Kind; x: number; y: number; w: number; h: number; sku: string; fill: string; rim: string }) {
  const base = y + h - 10; // plinth top
  const cx = x + w / 2 + (rand(`${sku}:dx`) - 0.5) * 6;
  const s = 0.9 + rand(`${sku}:s`) * 0.22; // size variation
  const art = drawKind(kind, cx, base, s, sku);
  return (
    <g aria-hidden="true">
      <rect x={x + 6} y={base} width={w - 12} height={4} rx={1.5} fill={fill} opacity={0.9} />
      <g fill={fill} stroke={rim} strokeWidth={0.8} strokeOpacity={0.55}>
        {art}
      </g>
    </g>
  );
}

function drawKind(kind: Kind, cx: number, b: number, s: number, sku: string): ReactNode {
  const r = (k: string) => rand(`${sku}:${k}`);
  switch (kind) {
    case 'tv': {
      const w = 56 * s;
      const h = 34 * s;
      return (
        <>
          <rect x={cx - w / 2} y={b - h - 8} width={w} height={h} rx={2} />
          <rect x={cx - 3} y={b - 8} width={6} height={6} />
          <rect x={cx - 14} y={b - 3} width={28} height={3} rx={1} />
        </>
      );
    }
    case 'laptop': {
      const w = 46 * s;
      return (
        <>
          <path d={`M${cx - w / 2 + 4},${b - 6} L${cx - w / 2 + 8},${b - 34 * s} L${cx + w / 2 - 8},${b - 34 * s} L${cx + w / 2 - 4},${b - 6} Z`} />
          <path d={`M${cx - w / 2 - 4},${b} L${cx - w / 2 + 4},${b - 6} L${cx + w / 2 - 4},${b - 6} L${cx + w / 2 + 4},${b} Z`} />
        </>
      );
    }
    case 'earbuds':
      return (
        <>
          <rect x={cx - 15 * s} y={b - 20 * s} width={30 * s} height={20 * s} rx={9 * s} />
          <circle cx={cx - 22 * s} cy={b - 6 * s} r={4.5 * s} />
          <rect x={cx - 23.5 * s} y={b - 18 * s} width={3} height={12 * s} rx={1.5} />
          <circle cx={cx + 23 * s} cy={b - 7 * s} r={4.5 * s} />
          <rect x={cx + 21.5 * s} y={b - 19 * s} width={3} height={12 * s} rx={1.5} />
        </>
      );
    case 'vacuum':
      return (
        <>
          <ellipse cx={cx} cy={b - 6 * s} rx={26 * s} ry={7 * s} />
          <rect x={cx - 26 * s} y={b - 7 * s} width={52 * s} height={6 * s} />
          <ellipse cx={cx} cy={b - 13 * s} rx={8 * s} ry={2.5 * s} />
        </>
      );
    case 'bedding':
      return (
        <>
          <rect x={cx - 28 * s} y={b - 10 * s} width={56 * s} height={10 * s} rx={3} />
          <rect x={cx - 25 * s} y={b - 20 * s} width={50 * s} height={10 * s} rx={3} />
          <rect x={cx - 22 * s} y={b - 30 * s} width={44 * s} height={10 * s} rx={3} />
          <ellipse cx={cx + 6 * s} cy={b - 36 * s} rx={16 * s} ry={6 * s} />
        </>
      );
    case 'pot':
      return (
        <>
          <ellipse cx={cx} cy={b - 13 * s} rx={22 * s} ry={13 * s} />
          <rect x={cx - 26 * s} y={b - 20 * s} width={52 * s} height={4} rx={2} />
          <path d={`M${cx - 18 * s},${b - 24 * s} Q${cx},${b - 34 * s} ${cx + 18 * s},${b - 24 * s} Z`} />
          <circle cx={cx} cy={b - 31 * s} r={3} />
        </>
      );
    case 'lamp':
      return (
        <>
          <path d={`M${cx - 12 * s},${b - 46 * s} L${cx + 12 * s},${b - 46 * s} L${cx + 18 * s},${b - 30 * s} L${cx - 18 * s},${b - 30 * s} Z`} />
          <rect x={cx - 1.5} y={b - 30 * s} width={3} height={26 * s} />
          <ellipse cx={cx} cy={b - 3} rx={10 * s} ry={3} />
          <rect x={cx + 22 * s} y={b - 14 * s} width={12 * s} height={14 * s} rx={2} />
        </>
      );
    case 'coat':
      return (
        <>
          <path d={`M${cx},${b - 64 * s} L${cx - 13 * s},${b - 54 * s} L${cx + 13 * s},${b - 54 * s} Z`} fill="none" strokeWidth={1.5} />
          <path
            d={`M${cx - 13 * s},${b - 54 * s} L${cx - 20 * s},${b - 46 * s} L${cx - 22 * s},${b - 10 * s} L${cx - 14 * s},${b - 6 * s} L${cx - 13 * s},${b - 30 * s} L${cx - 10 * s},${b - 2 * s} L${cx + 10 * s},${b - 2 * s} L${cx + 13 * s},${b - 30 * s} L${cx + 14 * s},${b - 6 * s} L${cx + 22 * s},${b - 10 * s} L${cx + 20 * s},${b - 46 * s} L${cx + 13 * s},${b - 54 * s} Z`}
          />
        </>
      );
    case 'bust':
      return (
        <>
          <path d={`M${cx - 16 * s},${b - 50 * s} Q${cx},${b - 60 * s} ${cx + 16 * s},${b - 50 * s} L${cx + 12 * s},${b - 22 * s} Q${cx},${b - 16 * s} ${cx - 12 * s},${b - 22 * s} Z`} />
          <rect x={cx - 1.5} y={b - 20 * s} width={3} height={18 * s} />
          <ellipse cx={cx} cy={b - 2} rx={9 * s} ry={2.5} />
        </>
      );
    case 'beanie':
      return (
        <>
          <path d={`M${cx - 20 * s},${b - 8 * s} Q${cx - 20 * s},${b - 38 * s} ${cx},${b - 38 * s} Q${cx + 20 * s},${b - 38 * s} ${cx + 20 * s},${b - 8 * s} Z`} />
          <rect x={cx - 22 * s} y={b - 10 * s} width={44 * s} height={9 * s} rx={3} />
          <circle cx={cx} cy={b - 42 * s} r={6 * s} />
        </>
      );
    case 'shoes':
      return (
        <>
          <path d={`M${cx - 30 * s},${b - 2} L${cx - 30 * s},${b - 14 * s} Q${cx - 24 * s},${b - 20 * s} ${cx - 18 * s},${b - 16 * s} L${cx - 4 * s},${b - 8 * s} Q${cx},${b - 5 * s} ${cx},${b - 2} Z`} />
          <path d={`M${cx + 2 * s},${b - 2} L${cx + 2 * s},${b - 18 * s} Q${cx + 9 * s},${b - 24 * s} ${cx + 15 * s},${b - 20 * s} L${cx + 28 * s},${b - 10 * s} Q${cx + 32 * s},${b - 7 * s} ${cx + 32 * s},${b - 2} Z`} />
        </>
      );
    case 'blocks': {
      const k = 2 + (hash(sku) % 2);
      return (
        <>
          {Array.from({ length: k + 2 }, (_, i) => {
            const row = i < 2 ? 0 : i < 4 ? 1 : 2;
            const col = i < 2 ? i : i - 2 * row;
            const bw = 18 * s;
            return <rect key={i} x={cx - bw + col * bw + row * (bw / 2) - (row ? bw / 2 : 0)} y={b - (row + 1) * 12 * s} width={bw - 2} height={11 * s} rx={1.5} />;
          })}
          <circle cx={cx + 26 * s} cy={b - 6 * s} r={6 * s} />
        </>
      );
    }
    case 'car':
      return (
        <>
          <path d={`M${cx - 26 * s},${b - 8 * s} L${cx - 22 * s},${b - 16 * s} L${cx - 8 * s},${b - 18 * s} L${cx + 2 * s},${b - 26 * s} L${cx + 16 * s},${b - 26 * s} L${cx + 26 * s},${b - 16 * s} L${cx + 28 * s},${b - 8 * s} Z`} />
          <circle cx={cx - 15 * s} cy={b - 6 * s} r={6 * s} />
          <circle cx={cx + 17 * s} cy={b - 6 * s} r={6 * s} />
          <rect x={cx + 14 * s} y={b - 36 * s} width={1.5} height={10 * s} />
        </>
      );
    case 'cube': {
      const c = 26 * s;
      return (
        <>
          <rect x={cx - c / 2} y={b - c - 2} width={c} height={c} rx={3} />
          <path d={`M${cx - c / 6},${b - c - 2} V${b - 2} M${cx + c / 6},${b - c - 2} V${b - 2} M${cx - c / 2},${b - 2 - (2 * c) / 3} H${cx + c / 2} M${cx - c / 2},${b - 2 - c / 3} H${cx + c / 2}`} fill="none" strokeOpacity={0.8} />
          <rect x={cx + c / 2 + 6} y={b - 14 * s} width={14 * s} height={14 * s} rx={2} />
        </>
      );
    }
    case 'teddy':
      return (
        <>
          <circle cx={cx} cy={b - 30 * s} r={10 * s} />
          <circle cx={cx - 8 * s} cy={b - 39 * s} r={4 * s} />
          <circle cx={cx + 8 * s} cy={b - 39 * s} r={4 * s} />
          <ellipse cx={cx} cy={b - 11 * s} rx={13 * s} ry={11 * s} />
        </>
      );
    case 'bottles': {
      const hs = [32, 42, 26].map((v, i) => v * s * (0.9 + r(`b${i}`) * 0.2));
      return (
        <>
          {hs.map((bh, i) => {
            const x = cx - 22 * s + i * 17 * s;
            return (
              <g key={i}>
                <rect x={x} y={b - bh} width={12 * s} height={bh} rx={3} />
                <rect x={x + 3.5 * s} y={b - bh - 7 * s} width={5 * s} height={8 * s} rx={1} />
              </g>
            );
          })}
        </>
      );
    }
    case 'dryer':
      return (
        <>
          <path d={`M${cx - 24 * s},${b - 40 * s} h${30 * s} a${11 * s},${11 * s} 0 0 1 0 ${22 * s} h${-30 * s} Z`} />
          <rect x={cx - 3 * s} y={b - 20 * s} width={9 * s} height={20 * s} rx={3} />
          <circle cx={cx + 6 * s} cy={b - 29 * s} r={4 * s} fillOpacity={0.6} />
        </>
      );
    case 'kit':
      return (
        <>
          <rect x={cx - 26 * s} y={b - 18 * s} width={52 * s} height={18 * s} rx={3} />
          <rect x={cx - 18 * s} y={b - 32 * s} width={8 * s} height={14 * s} rx={2} />
          <rect x={cx - 6 * s} y={b - 36 * s} width={6 * s} height={18 * s} rx={2} />
          <rect x={cx + 6 * s} y={b - 30 * s} width={12 * s} height={12 * s} rx={2} />
        </>
      );
    case 'coffee':
      return (
        <>
          <path d={`M${cx - 15 * s},${b} L${cx - 13 * s},${b - 42 * s} L${cx - 9 * s},${b - 48 * s} L${cx + 9 * s},${b - 48 * s} L${cx + 13 * s},${b - 42 * s} L${cx + 15 * s},${b} Z`} />
          <circle cx={cx + 26 * s} cy={b - 3 * s} r={3 * s} />
          <circle cx={cx + 31 * s} cy={b - 2.5 * s} r={2.5 * s} />
          <path d={`M${cx - 26 * s},${b} v${-12 * s} h${8 * s} v${12 * s} Z`} />
        </>
      );
    case 'hamper':
      return (
        <>
          <path d={`M${cx - 26 * s},${b - 24 * s} L${cx + 26 * s},${b - 24 * s} L${cx + 21 * s},${b} L${cx - 21 * s},${b} Z`} />
          <path d={`M${cx - 20 * s},${b - 24 * s} Q${cx},${b - 50 * s} ${cx + 20 * s},${b - 24 * s}`} fill="none" strokeWidth={2.5} />
          <circle cx={cx - 8 * s} cy={b - 28 * s} r={5 * s} />
          <rect x={cx + 2 * s} y={b - 36 * s} width={7 * s} height={12 * s} rx={2} />
        </>
      );
    case 'oil':
      return (
        <>
          {[0, 1, 2].map((i) => {
            const x = cx - 20 * s + i * 15 * s;
            const bh = (44 - i * 4) * s;
            return <path key={i} d={`M${x},${b} v${-bh * 0.66} q0,${-bh * 0.14} ${4 * s},${-bh * 0.22} v${-bh * 0.12} h${3 * s} v${bh * 0.12} q${4 * s},${bh * 0.08} ${4 * s},${bh * 0.22} v${bh * 0.66} Z`} />;
          })}
        </>
      );
    case 'crates':
      return (
        <>
          <rect x={cx - 26 * s} y={b - 18 * s} width={26 * s} height={18 * s} rx={1.5} />
          <rect x={cx + 2 * s} y={b - 18 * s} width={24 * s} height={18 * s} rx={1.5} />
          <rect x={cx - 13 * s} y={b - 34 * s} width={26 * s} height={15 * s} rx={1.5} />
        </>
      );
  }
}

/** One shopper standing at (fx, fy). Height, build and a bag are fixed by the key, so the queue never reshuffles. */
export function Shopper({ fx, fy, k, fill, rim, index }: { fx: number; fy: number; k: string; fill: string; rim: string; index: number }) {
  const h = 22 + rand(`${k}:h`) * 9;
  const wide = 3.6 + rand(`${k}:w`) * 1.6;
  const bag = rand(`${k}:bag`) > 0.55;
  const head = fy - h + 3.6;
  return (
    <g className="db-shopper" style={{ animationDelay: `${index * 60}ms` }} aria-hidden="true">
      <circle cx={fx} cy={head} r={3.5} fill={fill} />
      <path
        d={`M${fx - wide},${fy - h + 9.5} Q${fx},${fy - h + 7} ${fx + wide},${fy - h + 9.5} L${fx + wide - 0.6},${fy - h * 0.42} L${fx + 2.6},${fy - h * 0.4} L${fx + 2.4},${fy} L${fx + 0.6},${fy} L${fx},${fy - h * 0.3} L${fx - 0.6},${fy} L${fx - 2.4},${fy} L${fx - 2.6},${fy - h * 0.4} L${fx - wide + 0.6},${fy - h * 0.42} Z`}
        fill={fill}
      />
      {bag && <rect x={fx + wide - 0.5} y={fy - h * 0.5} width={4.5} height={5.5} rx={1} fill={fill} />}
      {/* Rim light from the window behind them. */}
      <path d={`M${fx - 3},${head - 2.4} A3.5,3.5 0 0 1 ${fx + 3},${head - 2.4}`} fill="none" stroke={rim} strokeWidth={0.9} strokeOpacity={0.8} />
      <path d={`M${fx - wide},${fy - h + 9.5} Q${fx},${fy - h + 7} ${fx + wide},${fy - h + 9.5}`} fill="none" stroke={rim} strokeWidth={0.9} strokeOpacity={0.55} />
    </g>
  );
}

/** Two brass stanchions and a sagging red rope across the front of a window: the deal waits for approval. */
export function VelvetRope({ x, w, fy }: { x: number; w: number; fy: number }) {
  const l = x + 8;
  const r = x + w - 8;
  const top = fy - 17;
  return (
    <g aria-hidden="true" data-testid="velvet-rope">
      <path d={`M${l},${top + 1} Q${(l + r) / 2},${top + 13} ${r},${top + 1}`} fill="none" stroke="var(--db-rope)" strokeWidth={3} strokeLinecap="round" />
      {[l, r].map((sx) => (
        <g key={sx}>
          <rect x={sx - 1.3} y={top} width={2.6} height={17} rx={1} fill="var(--db-brass)" />
          <circle cx={sx} cy={top - 1} r={2.6} fill="var(--db-brass)" />
          <ellipse cx={sx} cy={fy} rx={5} ry={1.6} fill="var(--db-brass)" />
        </g>
      ))}
    </g>
  );
}

/** A roll-down shutter over the top `drop` (0–1) of the glass. */
export function Shutter({ x, y, w, h, drop }: { x: number; y: number; w: number; h: number; drop: number }) {
  const hh = Math.max(4, h * drop);
  const lines = Math.floor(hh / 5);
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={w} height={hh} fill="var(--db-shutter)" />
      {Array.from({ length: lines }, (_, i) => (
        <line key={i} x1={x} x2={x + w} y1={y + 5 * (i + 1)} y2={y + 5 * (i + 1)} stroke="var(--db-shutter-line)" strokeWidth={1} />
      ))}
      <rect x={x} y={y + hh - 3} width={w} height={3} fill="var(--db-shutter-2)" />
    </g>
  );
}

/** Kraft paper taped over the glass (a draft nobody can buy yet). */
export function Paper({ x, y, w, h, k }: { x: number; y: number; w: number; h: number; k: string }) {
  const fold = 0.35 + rand(`${k}:fold`) * 0.3;
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} fill="var(--db-paper)" />
      <path d={`M${x},${y + h * fold} L${x + w},${y + h * (fold + 0.12)}`} stroke="var(--db-paper-2)" strokeWidth={1.2} />
      <path d={`M${x + w * 0.62},${y} L${x + w * 0.5},${y + h}`} stroke="var(--db-paper-2)" strokeWidth={1} />
      <rect x={x - 3} y={y + 3} width={16} height={6} fill="var(--db-tape)" transform={`rotate(-35 ${x + 5} ${y + 6})`} />
      <rect x={x + w - 13} y={y + 3} width={16} height={6} fill="var(--db-tape)" transform={`rotate(35 ${x + w - 5} ${y + 6})`} />
    </g>
  );
}

export function Whitewash({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} fill="var(--db-whitewash)" />
      {[0.2, 0.42, 0.64, 0.84].map((f, i) => (
        <path key={i} d={`M${x + 4},${y + h * f} Q${x + w / 2},${y + h * f - 6} ${x + w - 4},${y + h * f + 3}`} fill="none" stroke="var(--db-whitewash)" strokeWidth={7} strokeLinecap="round" />
      ))}
    </g>
  );
}
