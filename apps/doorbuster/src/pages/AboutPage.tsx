/** About: the pitch, how to use it, and the rules with the numbers from config.ts. */
import { Link } from 'react-router-dom';

import { PageHeader } from '@x10/shared/ui';

import { CURRENCY, pct0, rules } from '../config';

const RULES: [string, string][] = [
  ['Margin guard', `Margin is (deal price − unit cost) ÷ deal price. Below ${pct0(rules.MIN_MARGIN)} the Shopfront refuses to save and shows the margin it computed. A loss leader may go lower with a reason of ${rules.LOSS_REASON_MIN}+ characters, and always needs approval.`],
  ['Second person on deep discounts', `A discount (1 − deal price ÷ list price) over ${pct0(rules.DEEP_DISCOUNT)} waits at the Velvet rope until someone other than its owner approves it. Changing the prices afterwards sends it back to the rope.`],
  ['One deal per SKU at a time', 'Two deals on the same SKU cannot overlap in time. Cancelled deals do not count.'],
  ['Sell-out forecast', `Units sold per hour over the last ${rules.RATE_WINDOW_HOURS} hours project when stock reaches zero. Before the deal ends is a warning (the amber shutter); reaching zero ends the window early (sold out). Today lists deals with under ${rules.SELLOUT_SOON_HOURS} hours of stock.`],
  ['Status follows time', 'An approved deal goes live at its start and ends at its end, or when it sells out. Nothing time-driven is stored, so it never drifts.'],
];

const READS: [string, string][] = [
  ['Window brightness', 'Share of stock sold. Dark with a SOLD OUT neon: none left.'],
  ['Neon tag', 'The discount. Lenses re-colour it and the light by margin, discount, risk or category.'],
  ['Queue', `One shopper per ${rules.CROWD_UNITS_PER_SHOPPER} units sold in the last hour, up to ${rules.CROWD_MAX}.`],
  ['Amber shutter', 'Forecast to sell out before the deal ends, with the time on the shutter.'],
  ['Velvet rope', 'Waiting for a second person. Kraft paper: a draft; red stencil: below the margin floor.'],
  ['The clock', 'Units sold per 15 minutes. Drag it, or press R, to replay the day from the sales.'],
];

export function AboutPage() {
  return (
    <article className="max-w-[720px]">
      <PageHeader title="About Doorbuster" subtitle="A Cyber Monday deal desk, drawn as a midnight arcade." />
      <p className="mt-0 text-base leading-7">
        On Cyber Monday a retail team runs dozens of time-boxed deals. Doorbuster keeps three things from going wrong: a deal priced below cost, a deep
        discount nobody else looked at, and a hero product that sells out at nine with nobody noticing. Plan deals in the{' '}
        <Link to="/shopfront">Shopfront</Link>, approve the deep ones at the <Link to="/rope">Velvet rope</Link>, and watch every deal sell in the{' '}
        <Link to="/">arcade</Link> and the <Link to="/ticker">Ticker</Link>.
      </p>

      <h2 className="mb-3 mt-10 text-lg font-semibold">Reading the arcade</h2>
      <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-[160px_1fr]">
        {READS.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-sm font-medium">{k}</dt>
            <dd className="m-0 text-sm text-muted">{v}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mb-3 mt-10 text-lg font-semibold">Rules</h2>
      <ol className="m-0 space-y-4 pl-5">
        {RULES.map(([k, v]) => (
          <li key={k} className="text-sm">
            <span className="font-medium">{k}.</span> <span className="text-muted">{v}</span>
          </li>
        ))}
      </ol>

      <h2 className="mb-3 mt-10 text-lg font-semibold">Thresholds</h2>
      <dl className="m-0 grid grid-cols-[1fr_auto] border-t border-line text-sm" data-testid="thresholds">
        {[
          ['Margin floor', pct0(rules.MIN_MARGIN)],
          ['Deep discount, needs approval above', pct0(rules.DEEP_DISCOUNT)],
          ['Loss-leader reason, at least', `${rules.LOSS_REASON_MIN} characters`],
          ['Forecast rate window', `${rules.RATE_WINDOW_HOURS} hours`],
          ['Today: sells out within', `${rules.SELLOUT_SOON_HOURS} hours`],
          ['Receipts import, at most', `${rules.IMPORT_MAX_ROWS.toLocaleString()} rows`],
          ['Prices shown in', CURRENCY],
        ].map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="border-b border-line py-2.5 pr-6 text-muted">{k}</dt>
            <dd className="m-0 border-b border-line py-2.5 text-right font-mono num">{v}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mb-3 mt-10 text-lg font-semibold">Who does what</h2>
      <p className="mt-0 text-sm text-muted">
        Merchandisers plan and edit their own deals. Approvers decide at the Velvet rope, never on a deal they own. Admins do both and manage floor
        staff. Everyone else can see the arcade, the Ticker and the calendar. The database itself lets only a deal's owner change it and records
        every approval as a separate, unchangeable row by someone other than the owner.
      </p>

      <p className="mt-10 border-t border-line pt-4 text-ui text-muted">
        Doorbuster supports a pricing and approval process; it is not pricing, legal or financial advice. Runs on Microsoft Fabric Apps. Built by
        Datachain Consulting for AI @Work.
      </p>
    </article>
  );
}
