/**
 * Shopfront: plan or edit a deal with the margin guard live beside the form. Saving below the floor is blocked with
 * the computed margin; a deep discount or a loss leader goes to the velvet rope; one SKU, one deal at a time.
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Store, Trash2 } from 'lucide-react';

import { formatDateTime, fromLocalInput, HOUR, toLocalInput, useAction } from '@x10/shared/lib';
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorPanel,
  Field,
  Input,
  InlineError,
  LinkButton,
  PageHeader,
  Select,
  Skeleton,
  TextArea,
  cx,
} from '@x10/shared/ui';

import { StatusBadge } from '../components/bits';
import { useDesk } from '../components/useDesk';
import { WindowPreview } from '../components/WindowPreview';
import { money, pct1, rules } from '../config';
import { cancelDeal, deleteDraft, saveDeal } from '../domain/deals';
import { DEEP_LABEL, FLOOR_LABEL, formatMargin } from '../domain/pricing';
import { normaliseSku, validateDeal, type DealErrors, type DealInput } from '../domain/validate';
import { CATEGORIES, CATEGORY_LABEL, limits, type Category, type Deal } from '../model';

interface Form {
  name: string;
  sku: string;
  category: Category;
  listPrice: string;
  unitCost: string;
  dealPrice: string;
  stockUnits: string;
  targetUnits: string;
  startsAt: string;
  endsAt: string;
  lossLeader: boolean;
  lossReason: string;
}

function blankForm(now: number): Form {
  const start = Math.ceil(now / HOUR) * HOUR;
  return {
    name: '',
    sku: '',
    category: 'electronics',
    listPrice: '',
    unitCost: '',
    dealPrice: '',
    stockUnits: '',
    targetUnits: '',
    startsAt: toLocalInput(new Date(start).toISOString()),
    endsAt: toLocalInput(new Date(start + 12 * HOUR).toISOString()),
    lossLeader: false,
    lossReason: '',
  };
}

function fromDeal(d: Deal): Form {
  return {
    name: d.name,
    sku: d.sku,
    category: d.category,
    listPrice: String(d.listPrice),
    unitCost: String(d.unitCost),
    dealPrice: String(d.dealPrice),
    stockUnits: String(d.stockUnits),
    targetUnits: String(d.targetUnits),
    startsAt: toLocalInput(d.startsAt),
    endsAt: toLocalInput(d.endsAt),
    lossLeader: d.lossLeader,
    lossReason: d.lossReason ?? '',
  };
}

const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s.replace(/[\s,$]/g, '')));

function toInput(f: Form): DealInput {
  return {
    name: f.name,
    sku: f.sku,
    category: f.category,
    listPrice: num(f.listPrice),
    unitCost: num(f.unitCost),
    dealPrice: num(f.dealPrice),
    stockUnits: num(f.stockUnits),
    targetUnits: num(f.targetUnits),
    startsAt: fromLocalInput(f.startsAt),
    endsAt: fromLocalInput(f.endsAt),
    lossLeader: f.lossLeader,
    lossReason: f.lossReason,
  };
}

export function ShopfrontPage() {
  const { id } = useParams();
  return <ShopfrontForm key={id ?? 'new'} id={id} />;
}

function ShopfrontForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const { state, world, desk, actor, store, now } = useDesk(null, false);
  const deal = id ? world?.deals.find((d) => d.id === id) : undefined;
  const view = id ? desk?.views.find((v) => v.deal.id === id) : undefined;
  const [form, setForm] = useState<Form | null>(null);
  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({});
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);

  // Load the form once the deal (or a blank) is known.
  useEffect(() => {
    if (form) return;
    if (!id) setForm(blankForm(now));
    else if (deal) setForm(fromDeal(deal));
  }, [id, deal, form, now]);

  const input = form ? toInput(form) : null;
  const check = useMemo(() => (input && world ? validateDeal(input, world.deals, id) : null), [input, world, id]);

  const save = useAction(async (submit: boolean) => {
    setTried(true);
    if (!input || !check) return;
    if (!check.ok) return;
    const saved = await saveDeal(store, actor, input, { id, submit });
    navigate('/', { state: { focus: saved.id } });
  });
  const cancel = useAction(async () => {
    if (!deal) return;
    await cancelDeal(store, actor, deal.id);
    await state.reload();
    setConfirm(null);
  });
  const remove = useAction(async () => {
    if (!deal) return;
    await deleteDraft(store, actor, deal.id);
    navigate('/');
  });

  if (state.error && !world) return <ErrorPanel error={state.error} onRetry={() => void state.reload()} />;
  if (!world || !form || !check || !input) {
    if (world && id && !deal)
      return (
        <EmptyState title="That deal is gone" icon={<Store />} action={<LinkButton to="/shopfront">Plan a new deal</LinkButton>}>
          It may have been deleted as a draft.
        </EmptyState>
      );
    return <ShopfrontSkeleton />;
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const show = (k: keyof DealErrors & keyof Form) => (tried || touched[k] ? check.errors[k] : undefined);
  const blur = (k: keyof Form) => () => setTouched((t) => ({ ...t, [k]: true }));
  const g = check.guard;
  const priced = Number.isFinite(input.dealPrice) && Number.isFinite(input.unitCost) && Number.isFinite(input.listPrice);
  const editing = !!deal;
  const readOnly = editing && (deal.ownerSub !== actor.sub || deal.status === 'cancelled' || (view?.status === 'ended'));
  const cantCreate = !editing && !actor.canMerch;

  if (cantCreate)
    return (
      <>
        <PageHeader title="Shopfront" />
        <EmptyState title="Merchandisers plan deals here" icon={<Store />} action={<LinkButton to="/">Back to the arcade</LinkButton>}>
          You can see every deal in the arcade. Ask an admin for the merchandiser role to open a shopfront.
        </EmptyState>
      </>
    );

  const submitLabel = g.needsApproval ? 'Send to the velvet rope' : 'Open the shop';
  const profit = priced ? input.dealPrice - input.unitCost : Number.NaN;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to={editing ? `/ticker/${deal.id}` : '/'} className="inline-flex items-center gap-1 text-ui text-muted hover:text-fg">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> {editing ? 'Ticker' : 'Arcade'}
          </Link>
        }
        title={editing ? deal.name : 'Open a shopfront'}
        meta={
          editing && view ? (
            <>
              <StatusBadge v={view} />
              <span className="font-mono text-xs">{deal.sku}</span>
              <span className="text-ui text-muted">{deal.ownerSub === actor.sub ? 'Your deal' : deal.ownerName}</span>
            </>
          ) : undefined
        }
      />
      {readOnly && (
        <Callout tone="info" className="mb-5" title={deal!.ownerSub !== actor.sub ? `Only ${deal!.ownerName} can edit this deal` : 'This deal can no longer be edited'}>
          {deal!.ownerSub !== actor.sub ? 'You can read it here and follow it in the Ticker.' : 'Ended and cancelled deals stay as they were.'}
        </Callout>
      )}
      {view?.sentBack && (
        <Callout tone="warn" className="mb-5" title={`Sent back by ${view.sentBack.approverName}`}>
          {view.sentBack.note}
        </Callout>
      )}

      <form
        className="grid gap-8 pb-28 lg:grid-cols-[minmax(0,1fr)_320px] lg:pb-0"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(true);
        }}
      >
        <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
          <Group title="The deal">
            <TextField label="Deal name" value={form.name} onChange={(v) => set('name', v)} onBlur={blur('name')} error={show('name')} counter={limits.dealName.max} required />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <TextField label="SKU" value={form.sku} onChange={(v) => set('sku', v)} onBlur={() => { blur('sku')(); set('sku', normaliseSku(form.sku)); }} error={show('sku')} mono required hint="One deal per SKU at a time." />
              <SelectField label="Category" value={form.category} onChange={(v) => set('category', v as Category)} options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
            </div>
          </Group>

          <Group title="Price">
            <div className="grid gap-x-4 sm:grid-cols-3">
              <TextField label="List price" value={form.listPrice} onChange={(v) => set('listPrice', v)} onBlur={blur('listPrice')} error={show('listPrice')} numeric prefix="$" required />
              <TextField label="Unit cost" value={form.unitCost} onChange={(v) => set('unitCost', v)} onBlur={blur('unitCost')} error={show('unitCost')} numeric prefix="$" required />
              <TextField
                label="Deal price"
                value={form.dealPrice}
                onChange={(v) => set('dealPrice', v)}
                onBlur={blur('dealPrice')}
                error={(tried || touched.dealPrice) && check.errors.dealPrice !== g.message ? check.errors.dealPrice : undefined}
                numeric
                prefix="$"
                required
              />
            </div>
            <div className={cx('rounded-lg px-3 py-2.5 text-ui', g.blocked && priced ? 'bg-bad-soft' : g.lossLeaderOk ? 'bg-warn-soft' : 'bg-surface-sunken')} data-testid="margin-guard" data-blocked={g.blocked}>
              <GuardLine priced={priced} guard={g} profit={profit} />
            </div>
            <div className="mt-3">
              <Checkbox
                label="Loss leader"
                description={`Sell below the ${FLOOR_LABEL} floor on purpose. Needs a reason and always needs approval.`}
                checked={form.lossLeader}
                onChange={(v) => set('lossLeader', v)}
              />
            </div>
            {form.lossLeader && (
              <div className="mt-3">
                <Field label="Why it is worth the loss" htmlFor="db-reason" error={show('lossReason') ?? (g.belowFloor && form.lossReason.trim().length < rules.LOSS_REASON_MIN && form.lossReason ? check.errors.lossReason : undefined)} counter={{ value: form.lossReason.length, max: limits.lossReason.max }} hint={`At least ${rules.LOSS_REASON_MIN} characters.`}>
                  <TextArea id="db-reason" rows={3} value={form.lossReason} onChange={(e) => set('lossReason', e.target.value)} onBlur={blur('lossReason')} invalid={!!show('lossReason')} />
                </Field>
              </div>
            )}
          </Group>

          <Group title="Stock and window">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <TextField label="Stock" value={form.stockUnits} onChange={(v) => set('stockUnits', v)} onBlur={blur('stockUnits')} error={show('stockUnits')} numeric suffix="units" required />
              <TextField label="Target" value={form.targetUnits} onChange={(v) => set('targetUnits', v)} onBlur={blur('targetUnits')} error={show('targetUnits')} numeric suffix="units" required />
              <DateField label="Starts" value={form.startsAt} onChange={(v) => set('startsAt', v)} error={show('startsAt')} />
              <DateField label="Ends" value={form.endsAt} onChange={(v) => set('endsAt', v)} error={show('endsAt')} />
            </div>
          </Group>
        </fieldset>

        <aside className="lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start" aria-label="Window preview">
          <WindowPreview name={form.name} sku={form.sku} category={form.category} guard={g} valid={priced} />
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-ui">
            <dt className="text-muted">Margin</dt>
            <dd className={cx('m-0 text-right font-mono num', g.belowFloor && priced ? 'text-bad-text' : 'text-fg')} data-testid="guard-margin">
              {priced ? formatMargin(g.margin) : '—'}
            </dd>
            <dt className="text-muted">Discount</dt>
            <dd className="m-0 text-right font-mono num">{priced ? pct1(g.discount) : '—'}</dd>
            <dt className="text-muted">Approval</dt>
            <dd className="m-0 text-right">{!priced ? '—' : g.needsApproval ? <Badge tone="warn">Velvet rope</Badge> : <Badge tone="ok">Not needed</Badge>}</dd>
          </dl>
          {g.needsApproval && priced && !g.blocked && (
            <p className="mb-0 mt-3 text-ui text-muted">
              {form.lossLeader ? 'A loss leader' : `Over ${DEEP_LABEL} off`}: someone other than you approves it before the window lights.
            </p>
          )}
          {!readOnly && (
            <div className="fixed inset-x-0 bottom-[var(--x-bottom-inset,0px)] z-20 flex gap-2 border-t border-line bg-surface px-4 py-3 lg:static lg:mt-6 lg:flex-col lg:border-0 lg:bg-transparent lg:p-0">
              <Button type="submit" variant="primary" size="lg" className="flex-1" busy={save.pending} data-testid="submit-deal">
                {submitLabel}
              </Button>
              <Button type="button" size="lg" className="flex-1 lg:flex-none" onClick={() => void save.run(false)} disabled={save.pending}>
                Save draft
              </Button>
            </div>
          )}
          <InlineError error={save.error} className="mt-3" />
          {tried && !check.ok && (
            <p className="mb-0 mt-3 text-ui text-bad-text" role="alert" data-testid="form-blocked">
              {g.blocked && priced ? `Blocked: margin ${formatMargin(g.margin)} is below the ${FLOOR_LABEL} floor.` : 'Fix the marked fields to save.'}
            </p>
          )}
          {editing && deal.ownerSub === actor.sub && !readOnly && (
            <div className="mt-6 border-t border-line pt-4">
              {deal.status === 'draft' ? (
                <Button type="button" variant="ghost" icon={<Trash2 />} onClick={() => setConfirm('delete')}>
                  Delete draft
                </Button>
              ) : (
                <Button type="button" variant="ghost" icon={<Ban />} onClick={() => setConfirm('cancel')}>
                  Cancel the deal
                </Button>
              )}
            </div>
          )}
          {editing && <p className="mb-0 mt-4 text-xs text-faint">Last saved {formatDateTime(deal.updatedAt)}</p>}
        </aside>
      </form>

      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        title="Cancel this deal?"
        body="The window is whitewashed and the deal stops selling. Sales so far stay in the Ticker."
        confirmLabel="Cancel the deal"
        danger
        onConfirm={async () => {
          await cancel.run();
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title="Delete this draft?"
        body="Drafts have no sales or approvals, so nothing else is lost."
        confirmLabel="Delete draft"
        danger
        onConfirm={async () => {
          await remove.run();
        }}
      />
      <InlineError error={cancel.error ?? remove.error} className="mt-3" />
    </>
  );
}

function GuardLine({ priced, guard: g, profit }: { priced: boolean; guard: ReturnType<typeof validateDeal>['guard']; profit: number }) {
  if (!priced) return <span className="text-muted">Enter the list price, unit cost and deal price to see the margin.</span>;
  if (g.blocked) return <span className="font-medium text-bad-text">{g.message}</span>;
  if (g.lossLeaderOk) return <span className="text-warn-text">Loss leader at {formatMargin(g.margin)} margin: {money(Math.abs(profit))} lost per unit. It goes to the velvet rope.</span>;
  return (
    <span className="text-fg">
      Margin <span className="font-mono font-medium num">{formatMargin(g.margin)}</span>, above the {FLOOR_LABEL} floor · <span className="font-mono num">{money(profit)}</span> a unit
    </span>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7 border-b border-line pb-6 last:border-0">
      <h2 className="mb-4 mt-0 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  onBlur,
  error,
  counter,
  required,
  numeric,
  mono,
  prefix,
  suffix,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  counter?: number;
  required?: boolean;
  numeric?: boolean;
  mono?: boolean;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} required={required} hint={hint} counter={counter ? { value: value.length, max: counter } : undefined}>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ui text-faint">{prefix}</span>}
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          invalid={!!error}
          inputMode={numeric ? 'decimal' : undefined}
          className={cx(numeric || mono ? 'font-mono num' : undefined, numeric && 'text-right', prefix && 'pl-7', suffix && 'pr-12')}
          autoComplete="off"
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">{suffix}</span>}
      </div>
    </Field>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function DateField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} required>
      <Input id={id} type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} invalid={!!error} className="font-mono num" />
    </Field>
  );
}

function ShopfrontSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the shopfront">
      <Skeleton width={260} height={28} className="mb-8" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i}>
              <Skeleton width={90} height={12} className="mb-2" />
              <Skeleton height={32} />
            </div>
          ))}
        </div>
        <Skeleton height={300} className="rounded-xl" />
      </div>
    </div>
  );
}
