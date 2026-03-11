/**
 * Navigation Timing diagram builder.
 *
 * Converts a NavigationTiming record into all the data needed to render the
 * diagram in AllMetrics.astro — spans, ticks, legend items, and the raw
 * timestamp table.  Keeping this out of the component makes it testable and
 * keeps the Astro frontmatter thin.
 */
import type {
  NavigationTiming,
  DiagramTick,
  DiagramSpan,
  DiagramPageSeg,
  DiagramLegendItem,
  NavTimingDiagram,
} from '../types/metrics.js';
import { selectTtfbField } from './extractors.js';

// ── Colours ───────────────────────────────────────────────────────────────────

const COLOR = {
  redirect: '#a0a0a0',
  dns: '#1a6b52',
  tcp: '#e07820',
  tls: '#7b3fb0',
  request: '#7dd3fc',
  response: '#3b82f6',
  ttfb: '#f59e0b',
  dom: '#fb7185', // pink
  loadEvent: '#1e3a8a',
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert an absolute timestamp to a 0–100 % position along the timeline. */
function toPct(ts: number, base: number, totalMs: number): number {
  return Math.max(0, Math.min(100, ((ts - base) / totalMs) * 100));
}

/** Duration between two timestamps as %, clamped so it never overflows. */
function durPct(
  start: number,
  end: number,
  base: number,
  totalMs: number,
): number {
  return Math.max(
    0,
    Math.min(
      100 - toPct(start, base, totalMs),
      ((end - start) / totalMs) * 100,
    ),
  );
}

// ── Static field definitions ──────────────────────────────────────────────────

type NavField = keyof NavigationTiming;
type TickField = { field: NavField; group?: string };
type TsField = { field: NavField; note?: string };

// FR ticks: always-present fields (redirect and TLS entries are spliced in dynamically)
const FR_TICK_BASE: TickField[] = [
  { field: 'fetchStart' },
  { field: 'domainLookupStart', group: 'DNS' },
  { field: 'domainLookupEnd', group: 'DNS' },
  { field: 'connectStart', group: 'TCP' },
  // connectEnd group depends on hasTls — injected at runtime
  { field: 'requestStart', group: 'Request' },
  { field: 'responseStart', group: 'Response' },
  { field: 'responseEnd', group: 'Response' },
];

const FR_TICK_REDIRECT: TickField[] = [
  { field: 'redirectStart', group: 'Redirect' },
  { field: 'redirectEnd', group: 'Redirect' },
];

const FR_TICK_TLS: TickField[] = [
  { field: 'secureConnectionStart', group: 'TLS' },
];

// Canonical timestamp order used to sort the assembled FR tick list
const FR_TICK_ORDER: NavField[] = [
  'fetchStart',
  'redirectStart',
  'redirectEnd',
  'domainLookupStart',
  'domainLookupEnd',
  'connectStart',
  'secureConnectionStart',
  'connectEnd',
  'requestStart',
  'responseStart',
  'responseEnd',
];

const PAGE_TICK_FIELDS: TickField[] = [
  { field: 'domInteractive' },
  { field: 'domContentLoadedEventStart', group: 'DCL' },
  { field: 'domContentLoadedEventEnd' },
  { field: 'domComplete' },
  { field: 'loadEventStart', group: 'Page Load' },
  { field: 'loadEventEnd' },
];

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
  { field: 'domContentLoadedEventStart' },
  { field: 'domContentLoadedEventEnd' },
  { field: 'domComplete' },
  { field: 'loadEventStart' },
  { field: 'loadEventEnd' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function frTickFields(hasRedirect: boolean, hasTls: boolean): TickField[] {
  const fields: TickField[] = [
    ...(hasRedirect ? FR_TICK_REDIRECT : []),
    ...FR_TICK_BASE,
    { field: 'connectEnd' as NavField, group: hasTls ? 'TLS' : 'TCP' },
    ...(hasTls ? FR_TICK_TLS : []),
  ];
  return fields.sort(
    (a, b) => FR_TICK_ORDER.indexOf(a.field) - FR_TICK_ORDER.indexOf(b.field),
  );
}

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

export function buildNavTimingDiagram(nav: NavigationTiming): NavTimingDiagram {
  const base = nav.fetchStart ?? 0;
  const totalMs = Math.max((nav.loadEventEnd ?? nav.duration ?? 0) - base, 1);
  const pct = (ts: number | undefined) =>
    ts === undefined ? 0 : toPct(ts, base, totalMs);
  const dur = (s: number, e: number) => durPct(s, e, base, totalMs);
  const relMs = (ts: number) => Math.round(ts - base);

  const hasRedirect = (nav.redirectEnd ?? 0) > (nav.redirectStart ?? 0);
  const hasTls = (nav.secureConnectionStart ?? 0) > 0;
  const ttfbField = selectTtfbField(nav) as NavField;

  // ── First-request spans ────────────────────────────────────────────────────

  const frSpans: DiagramSpan[] = [];

  function addSpan(
    label: string,
    start: number | undefined,
    end: number | undefined,
    color: string,
  ) {
    if (start === undefined || end === undefined || end <= start) return;
    frSpans.push({
      label,
      ms: Math.round(end - start),
      leftPct: pct(start),
      widthPct: dur(start, end),
      color,
    });
  }

  const tcpEnd = hasTls ? nav.secureConnectionStart : nav.connectEnd;
  if (hasRedirect) {
    addSpan('Redirect', nav.redirectStart, nav.redirectEnd, COLOR.redirect);
  }
  addSpan('DNS', nav.domainLookupStart, nav.domainLookupEnd, COLOR.dns);
  addSpan('TCP', nav.connectStart, tcpEnd, COLOR.tcp);
  if (hasTls) {
    addSpan('TLS', nav.secureConnectionStart, nav.connectEnd, COLOR.tls);
  }
  addSpan('Request', nav.requestStart, nav.responseStart, COLOR.request);
  addSpan('Response', nav.responseStart, nav.responseEnd, COLOR.response);

  // ── First-request ticks ────────────────────────────────────────────────────

  const frTicks: DiagramTick[] = [];
  let laneCounter = 0;

  function makeTick(
    field: NavField,
    group: string | undefined,
    color?: string,
  ): DiagramTick | null {
    const ts = nav[field] as number | undefined;
    if (ts === undefined) return null;
    const leftPct = pct(ts);
    return {
      field,
      leftPct,
      msRel: relMs(ts),
      lane: laneCounter++ % 4,
      align: leftPct > 75 ? 'right' : 'left',
      group,
      color,
    };
  }
  // push all ticks
  for (const { field, group } of frTickFields(hasRedirect, hasTls)) {
    const tick = makeTick(field, group);
    if (tick) frTicks.push(tick);
  }
  // TTFB tick — amber, always shown (bypasses dedup)
  const ttfbTs = nav[ttfbField] as number | undefined;
  const ttfbMs = ttfbTs !== undefined ? relMs(ttfbTs) : 0;
  let ttfbMarker: { leftPct: number; ms: number } | null = null;
  if (ttfbTs !== undefined) {
    const ttfbLeftPct = pct(ttfbTs);
    ttfbMarker = { leftPct: ttfbLeftPct, ms: ttfbMs };
    frTicks.push({
      field: `TTFB (${ttfbField})`,
      leftPct: ttfbLeftPct,
      msRel: ttfbMs,
      lane: laneCounter++ % 4,
      align: ttfbLeftPct > 75 ? 'right' : 'left', // right side labels right aligned
      color: COLOR.ttfb,
      group: 'TTFB',
    });
  }
  const frLegend: DiagramLegendItem[] = [
    ...frSpans.map(s => ({ label: s.label, ms: s.ms, color: s.color })),
    {
      label: 'TTFB',
      ms: ttfbMs,
      color: COLOR.ttfb,
      secondary: `(via ${ttfbField})`,
    },
  ];

  // ── Page-scoped segments ───────────────────────────────────────────────────

  const pageSegs: DiagramPageSeg[] = [];
  const pageLegend: DiagramLegendItem[] = [];
  let hasFuzzyDom = false;
  // DCL, fuzzy left
  if (
    nav.responseStart !== undefined &&
    nav.domComplete !== undefined &&
    nav.domComplete > nav.responseStart
  ) {
    const domMs = Math.round(nav.domContentLoadedEventStart);
    const fuzzyEndTs = nav.responseEnd ?? nav.responseStart;
    const fuzzyFrac =
      nav.domComplete > fuzzyEndTs
        ? ((fuzzyEndTs - nav.responseStart) /
            (nav.domComplete - nav.responseStart)) *
          100
        : 0;
    hasFuzzyDom = fuzzyFrac > 0;
    const rgb = '251,113,133'; // matches COLOR.dom = #fb7185
    const domBg = hasFuzzyDom
      ? `linear-gradient(to right, rgba(${rgb},0) 0%, rgba(${rgb},0.45) ${(fuzzyFrac * 0.5).toFixed(1)}%, ${COLOR.dom} ${fuzzyFrac.toFixed(1)}%, ${COLOR.dom} 100%)`
      : COLOR.dom;
    pageSegs.push({
      label: 'DCL',
      ms: domMs,
      leftPct: pct(nav.responseStart),
      widthPct: dur(nav.responseStart, nav.domContentLoadedEventStart),
      bg: domBg,
    });
    pageLegend.push({
      label: 'DCL',
      ms: domMs,
      color: COLOR.dom,
      note: hasFuzzyDom ? '*' : undefined,
    });
  }
  // Page Loads
  if (
    nav.loadEventStart !== undefined &&
    nav.loadEventEnd !== undefined &&
    nav.loadEventEnd > nav.loadEventStart
  ) {
    const leMs = Math.round(nav.loadEventEnd - nav.loadEventStart);
    pageSegs.push({
      label: 'Page Load',
      ms: leMs,
      leftPct: pct(nav.loadEventStart),
      widthPct: dur(nav.loadEventStart, nav.loadEventEnd),
      bg: COLOR.loadEvent,
    });
    pageLegend.push({ label: 'Page Load', ms: leMs, color: COLOR.loadEvent });
  }

  // ── Page-scoped ticks ──────────────────────────────────────────────────────
  const pageTicks: DiagramTick[] = [];
  const seenPcts = new Set<string>();
  for (const { field, group } of PAGE_TICK_FIELDS) {
    const ts = nav[field] as number | undefined;
    if (ts === undefined || ts <= 0) continue;
    const leftPct = pct(ts);
    if (seenPcts.has(leftPct.toFixed(2))) continue;
    seenPcts.add(leftPct.toFixed(2));
    const isDCLStart = field === 'domContentLoadedEventStart';
    const isLoadEventStart = field === 'loadEventStart';
    pageTicks.push({
      field,
      leftPct,
      msRel: relMs(ts),
      lane: laneCounter++ % 4,
      align: leftPct > 75 ? 'right' : 'left',
      group,
      color: isDCLStart
        ? COLOR.dom
        : isLoadEventStart
          ? COLOR.loadEvent
          : undefined,
    });
  }

  // ── Raw timestamp table ────────────────────────────────────────────────────

  const navTimestampRows = tsFieldDefs(ttfbField)
    .map(({ field, note }) => {
      const ms = nav[field] as number | undefined;
      return ms !== undefined && ms > 0
        ? { field, msRel: relMs(ms), note }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return {
    totalMs,
    frTicks,
    pageTicks,
    frSpans,
    pageSegs,
    frLegend,
    pageLegend,
    ttfbMarker,
    ttfbField,
    hasFuzzyDom,
    navTimestampRows,
  };
}
