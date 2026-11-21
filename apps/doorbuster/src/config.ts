/**
 * Rules and thresholds. The About page and the Shopfront read these, so the numbers on screen are the numbers enforced.
 */
export const rules = {
  /** Margin (dealPrice − unitCost) / dealPrice below this blocks saving, unless the deal is a flagged loss leader. */
  MIN_MARGIN: 0.08,
  /** Discount 1 − dealPrice / listPrice above this needs approval by someone other than the owner. */
  DEEP_DISCOUNT: 0.4,
  /** A loss leader's reason needs at least this many characters. */
  LOSS_REASON_MIN: 20,
  /** Sell-out forecast: units sold per hour over the last RATE_WINDOW_HOURS project when stock reaches zero. */
  RATE_WINDOW_HOURS: 2,
  /** A projection needs at least this many minutes of selling in the window. */
  MIN_RATE_MINUTES: 15,
  /** Today lists deals forecast to sell out within this many hours. */
  SELLOUT_SOON_HOURS: 2,
  /** One shopper in the queue outside a window per this many units an hour (last hour). */
  CROWD_UNITS_PER_SHOPPER: 8,
  /** The queue outside a window never grows past this. */
  CROWD_MAX: 7,
  /** Margin bands for the margin lens. */
  THIN_MARGIN: 0.15,
  RICH_MARGIN: 0.3,
  /** Discount bands for the discount lens (the deep band starts at DEEP_DISCOUNT). */
  LIGHT_DISCOUNT: 0.2,
  /** Receipts: most rows in one CSV import. */
  IMPORT_MAX_ROWS: 2000,
  /** Most units one receipt row may carry (catches a pasted revenue column). */
  MAX_TICK_UNITS: 10_000,
  /** Sent-back notes need at least this many characters. */
  SEND_BACK_MIN: 10,
  /** Live screens poll this often. */
  POLL_MS: 5000,
} as const;

/** Prices are shown in this currency (the data stores plain decimals). */
export const CURRENCY = 'USD';

export const money = (v: number, digits = 2) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);

export const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
export const pct0 = (v: number) => `${Math.round(v * 100)}%`;
