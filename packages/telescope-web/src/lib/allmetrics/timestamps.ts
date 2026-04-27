/**
 * Timestamp table for navigation timing diagram.
 * Lists all available timing fields with relative ms values.
 */
import type { NavigationTiming } from '../types/metrics.js';
import type { NavField, TsField } from './shared.js';

// ── Field definitions ─────────────────────────────────────────────────────────

// Timestamp table fields (ttfbField and optional responseStart are spliced in at runtime)
const TS_FIELDS_PRE: TsField[] = [
  { field: 'fetchStart' },
  { field: 'redirectStart' },
  { field: 'redirectEnd' },
  { field: 'domainLookupStart' },
  { field: 'domainLookupEnd' },
  { field: 'connectStart' },
  { field: 'secureConnectionStart' },
  { field: 'connectEnd' },
  { field: 'requestStart' },
];

const TS_FIELDS_POST: TsField[] = [
  { field: 'responseEnd' },
  { field: 'domInteractive' },
  { field: 'domContentLoadedEventStart', note: 'used for DCL' },
  { field: 'domContentLoadedEventEnd' },
  { field: 'domComplete' },
  { field: 'loadEventStart', note: 'used for Page Load' },
  { field: 'loadEventEnd' },
];

// ── Helper function ───────────────────────────────────────────────────────────

/**
 * Assemble timestamp table field definitions.
 * Injects TTFB field in the correct position.
 */
function tsFieldDefs(ttfbField: NavField): TsField[] {
  return [
    ...TS_FIELDS_PRE,
    { field: ttfbField, note: 'used for TTFB' },
    ...(ttfbField !== 'responseStart'
      ? [{ field: 'responseStart' as NavField }]
      : []),
    ...TS_FIELDS_POST,
  ];
}

// ── Main builder ──────────────────────────────────────────────────────────────

export type TimestampRow = {
  field: string;
  msRel: number;
  note?: string;
};

export type TimestampContext = {
  nav: NavigationTiming;
  ttfbField: NavField;
  relMs: (ts: number) => number;
};

/**
 * Build timestamp table rows.
 */
export function buildTimestampRows(ctx: TimestampContext): TimestampRow[] {
  const { nav, ttfbField, relMs } = ctx;
  return tsFieldDefs(ttfbField)
    .map(({ field, note }) => {
      const ms = nav[field] as number | undefined;
      return ms !== undefined && ms > 0
        ? { field, msRel: relMs(ms), note }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}
