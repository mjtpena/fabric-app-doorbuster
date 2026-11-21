/**
 * Receipts: import sales ticks from a CSV (sku,at,units,revenue). Every row is checked on its own; rows with an error
 * (an unknown SKU, a time outside every deal window, a duplicate) are listed with the reason and the rest import.
 */
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileUp, ReceiptText } from 'lucide-react';

import { downloadText, formatDateTime, useAction } from '@x10/shared/lib';
import {
  Button,
  Callout,
  EmptyState,
  ErrorPanel,
  Field,
  InlineError,
  PageHeader,
  Skeleton,
  Table,
  TableWrap,
  Td,
  TextArea,
  Th,
  Toast,
  Tr,
  cx,
} from '@x10/shared/ui';

import { useDesk } from '../components/useDesk';
import { money, rules } from '../config';
import { importReceipts } from '../domain/deals';
import { parseReceipts, receiptTemplate, RECEIPT_COLUMNS } from '../domain/receipts';

export function ReceiptsPage() {
  const { state, world, desk, actor, store, now } = useDesk(null, false);
  const [text, setText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const notSelling = useMemo(() => new Map((desk?.views ?? []).filter((v) => v.status === 'pending').map((v) => [v.deal.id, 'waits for approval'])), [desk]);
  const parsed = useMemo(
    () => (world && text.trim() ? parseReceipts(text, world.deals, world.ticks, new Date(now), notSelling) : null),
    [text, world, now, notSelling],
  );

  const run = useAction(async () => {
    if (!parsed) return;
    const n = await importReceipts(store, actor, parsed.rows);
    await state.reload();
    setText('');
    setToast(`${n} ${n === 1 ? 'sale' : 'sales'} imported${parsed.bad ? `, ${parsed.bad} skipped` : ''}.`);
  });

  if (state.error && !world) return <ErrorPanel error={state.error} onRetry={() => void state.reload()} />;
  if (!world)
    return (
      <div aria-busy="true" aria-label="Loading receipts">
        <Skeleton width={180} height={28} className="mb-6" />
        <Skeleton height={200} />
      </div>
    );

  if (!actor.canMerch)
    return (
      <>
        <PageHeader title="Receipts" />
        <EmptyState title="Merchandisers import receipts" icon={<ReceiptText />}>
          The Ticker shows every sale as it arrives. Ask an admin for the merchandiser role to import a till export.
        </EmptyState>
      </>
    );

  const selling = new Set(desk?.views.filter((v) => v.status === 'live' && !v.soldOut).map((v) => v.deal.id) ?? []);
  const template = () => receiptTemplate(world.deals.filter((d) => selling.has(d.id)), new Date(now));

  return (
    <>
      <PageHeader
        title="Receipts"
        meta={<span className="font-mono text-ui text-muted">{RECEIPT_COLUMNS.join(',')}</span>}
        actions={
          <Button icon={<Download />} onClick={() => downloadText('doorbuster-receipts-template.csv', template())}>
            Template
          </Button>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <Field label="Till export (CSV)" htmlFor="receipts-csv" hint={`One row per sale interval. Times in your time zone unless they carry one. Up to ${rules.IMPORT_MAX_ROWS} rows.`}>
            <TextArea
              id="receipts-csv"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="font-mono text-xs"
              placeholder={'sku,at,units,revenue\nEL-EB-PUL,2026-11-30T09:15,4,316.00'}
              spellCheck={false}
            />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Choose a CSV file"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setText(await f.text());
                e.target.value = '';
              }}
            />
            <Button icon={<FileUp />} onClick={() => fileRef.current?.click()}>
              Choose a file
            </Button>
            <Button variant="ghost" onClick={() => setText(template())}>
              Use the template
            </Button>
          </div>
        </div>
        <aside className="text-ui text-muted" aria-label="How rows are matched">
          <ul className="m-0 list-none space-y-2 p-0">
            <li>The SKU must belong to a deal; the time must fall inside that deal's window.</li>
            <li>Units are whole numbers; revenue may carry a currency sign.</li>
            <li>A row already imported (same SKU, time and units) is skipped.</li>
          </ul>
        </aside>
      </div>

      {parsed?.fileError && (
        <Callout tone="bad" className="mt-6" title="This file cannot be imported">
          {parsed.fileError}
        </Callout>
      )}

      {parsed && !parsed.fileError && (
        <section className="mt-8" aria-labelledby="receipts-preview">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="receipts-preview" className="m-0 text-base font-semibold">
              Preview
            </h2>
            <span className="text-ui num" data-testid="receipts-summary">
              <span className="text-ok-text">{parsed.ok} ready</span>
              {parsed.bad > 0 && <span className="text-bad-text"> · {parsed.bad} with errors</span>}
            </span>
          </div>
          <ol className="m-0 list-none divide-y divide-[var(--line)] border-y border-line p-0 md:hidden" aria-label="Rows in the file">
            {parsed.rows.map((r) => (
              <li key={r.line} className="flex gap-3 py-2.5 text-ui" data-testid="receipt-row-phone" data-ok={!r.error}>
                <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', r.error ? 'bg-bad-solid' : 'bg-ok-solid')} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-muted">
                    <span>line {r.line}</span>
                    <span className="text-fg">{r.sku || '—'}</span>
                    {Number.isFinite(r.units) && <span>{r.units} units</span>}
                    {Number.isFinite(r.revenue) && <span>{money(r.revenue)}</span>}
                  </span>
                  <span className={cx('mt-0.5 block', r.error ? 'text-bad-text' : 'text-fg')}>{r.error ?? r.dealName}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="hidden md:block">
          <TableWrap label="Rows in the file" maxHeight={420}>
            <Table density="compact" stickyHeader data-testid="receipts-table">
              <thead>
                <tr>
                  <Th numeric>Line</Th>
                  <Th>SKU</Th>
                  <Th>Time</Th>
                  <Th numeric>Units</Th>
                  <Th numeric>Revenue</Th>
                  <Th>Result</Th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((r) => (
                  <Tr key={r.line} data-testid="receipt-row" data-ok={!r.error}>
                    <Td numeric muted>
                      {r.line}
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs">{r.sku || '—'}</Td>
                    <Td className="whitespace-nowrap text-xs">{r.at ? formatDateTime(r.at) : '—'}</Td>
                    <Td numeric>{Number.isFinite(r.units) ? r.units : '—'}</Td>
                    <Td numeric>{Number.isFinite(r.revenue) ? money(r.revenue) : '—'}</Td>
                    <Td className={cx('min-w-[220px] text-ui', r.error ? 'text-bad-text' : 'text-fg')}>
                      <span className="inline-flex items-start gap-2">
                        <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', r.error ? 'bg-bad-solid' : 'bg-ok-solid')} aria-hidden="true" />
                        {r.error ?? (
                          <span>
                            {r.dealName}
                          </span>
                        )}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" busy={run.pending} disabled={!parsed.ok} onClick={() => void run.run()} data-testid="import">
              {parsed.ok ? `Import ${parsed.ok} ${parsed.ok === 1 ? 'row' : 'rows'}` : 'Nothing to import'}
            </Button>
            {parsed.bad > 0 && <span className="text-ui text-muted">Rows with errors are skipped.</span>}
          </div>
          <InlineError error={run.error} className="mt-3" />
        </section>
      )}
      {!parsed && (
        <p className="mt-8 text-ui text-muted">
          Imported sales show in the <Link to="/ticker">Ticker</Link> and light the windows in the <Link to="/">arcade</Link>.
        </p>
      )}
      {toast && <Toast message={toast} tone="ok" onDone={() => setToast(null)} />}
    </>
  );
}
