/**
 * The Shopfront's live preview: the shop window this deal will light, drawn with the arcade's own art. Blocked by the
 * margin guard, it is papered over with the margin stencilled in red; a deep discount stands behind the velvet rope.
 */
import { Goods, Paper, VelvetRope, goodsKind } from '../arcade/art';
import { ClockDefs } from '../arcade/Clock';
import { formatMargin, FLOOR_LABEL, discountBand, type GuardResult } from '../domain/pricing';
import type { Category } from '../model';

const COLOR = { light: 'var(--db-neon-info)', mid: 'var(--db-neon-volt)', deep: 'var(--db-neon-hot)' } as const;

export function WindowPreview({ name, sku, category, guard, valid }: { name: string; sku: string; category: Category; guard: GuardResult; valid: boolean }) {
  const W = 220;
  const x = 46;
  const y = 30;
  const w = 128;
  const h = 170;
  const band = discountBand(guard.discount);
  const color = COLOR[band];
  const blocked = guard.blocked;
  const kind = goodsKind(name || 'deal', category, sku || 'SKU');
  const tag = valid && Number.isFinite(guard.discount) && guard.discount > 0 ? `−${Math.round(guard.discount * 100)}%` : '−?%';
  return (
    <svg viewBox={`0 0 ${W} 270`} className="db-sky mx-auto block w-full max-w-[280px] rounded-xl" role="img" aria-label={blocked ? `Window papered over: margin ${formatMargin(guard.margin)} is below the floor` : `Window preview: ${tag} off`} data-testid="window-preview" data-blocked={blocked}>
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
        <radialGradient id="db-preview-light" cx="50%" cy="22%" r="85%">
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset="55%" stopColor={color} stopOpacity={0.55} />
          <stop offset="100%" stopColor={color} stopOpacity={0.12} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={W} height={18} fill="var(--db-fascia)" />
      <text x={W / 2} y={13} textAnchor="middle" fontSize={9} fontWeight={700} letterSpacing="0.3em" fill="var(--db-neon-white)" stroke="var(--db-neon-volt)" strokeWidth={0.4}>
        {category.toUpperCase()}
      </text>
      <rect x={0} y={18} width={W} height={212} fill="var(--db-facade)" />
      <rect x={x - 5} y={y - 6} width={w + 10} height={h + 11} rx={2} fill="var(--db-frame)" />
      <rect x={x} y={y} width={w} height={h} fill="var(--db-glass-dark)" />
      {!blocked && <rect className="db-light" x={x} y={y} width={w} height={h} fill="url(#db-preview-light)" opacity={0.85} />}
      {!blocked && <Goods kind={kind} x={x} y={y} w={w} h={h} sku={sku || 'SKU'} fill="var(--db-glass-deep)" rim={color} />}
      {!blocked && (
        <g>
          <text x={x + w / 2} y={y + 40} textAnchor="middle" fontSize={28} fontWeight={700} fill={color} filter="url(#db-glow)" style={{ fontFamily: 'var(--mono)', opacity: 'var(--db-glow)' }}>
            {tag}
          </text>
          <text x={x + w / 2} y={y + 40} textAnchor="middle" fontSize={28} fontWeight={700} fill="var(--db-neon-white)" stroke={color} strokeWidth={0.9} style={{ fontFamily: 'var(--mono)' }} data-testid="preview-tag">
            {tag}
          </text>
        </g>
      )}
      {blocked && (
        <g>
          <Paper x={x} y={y} w={w} h={h} k={sku || 'SKU'} />
          <g transform={`rotate(-8 ${x + w / 2} ${y + h / 2})`}>
            <rect x={x + 10} y={y + h / 2 - 26} width={w - 20} height={50} rx={3} fill="none" stroke="var(--db-neon-bad)" strokeWidth={2} />
            <text x={x + w / 2} y={y + h / 2 - 1} textAnchor="middle" fontSize={20} fontWeight={800} fill="var(--db-neon-bad)" style={{ fontFamily: 'var(--mono)' }}>
              {formatMargin(guard.margin)}
            </text>
            <text x={x + w / 2} y={y + h / 2 + 15} textAnchor="middle" fontSize={9} fontWeight={700} letterSpacing="0.1em" fill="var(--db-neon-bad)">
              {`UNDER ${FLOOR_LABEL} FLOOR`}
            </text>
          </g>
        </g>
      )}
      <rect x={x - 5} y={y + h + 5} width={w + 10} height={16} fill="var(--db-sill)" />
      <text x={x} y={y + h + 16} fontSize={9.5} fontWeight={600} fill="var(--db-sill-ink)">
        {(name || 'New deal').slice(0, 24)}
      </text>
      <rect x={-10} y={230} width={W + 20} height={40} fill="var(--db-street)" />
      {!blocked && guard.needsApproval && <VelvetRope x={x} w={w} fy={252} />}
    </svg>
  );
}
