/**
 * First Request section of navigation timing diagram.
 * Handles DNS, TCP, TLS, Request, Response phases.
 */
import type {
  NavigationTiming,
  DiagramTick,
  DiagramSpan,
  DiagramLegendItem,
} from '../types/metrics.js';
import { selectTtfbField } from '../utils/extractors.js';
import { COLOR, type NavField, type TickField } from './shared.js';

// ── Field definitions ─────────────────────────────────────────────────────────

// Always-present fields (redirect and TLS entries are added dynamically)
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

// ── Helper functions ──────────────────────────────────────────────────────────

/**
 * Assemble the complete list of FR tick fields based on conditions.
 */
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

// ── Main builder ──────────────────────────────────────────────────────────────

export type FirstRequestData = {
  frSpans: DiagramSpan[];
  frTicks: DiagramTick[];
  frLegend: DiagramLegendItem[];
  ttfbMarker: { leftPct: number; ms: number } | null;
  ttfbField: string;
};

export type FirstRequestContext = {
  nav: NavigationTiming;
  base: number;
  totalMs: number;
  pct: (ts: number | undefined) => number;
  dur: (s: number, e: number) => number;
  relMs: (ts: number) => number;
  laneCounter: number;
};

/**
 * Build all data for the First Request section.
 */
export function buildFirstRequest(ctx: FirstRequestContext): FirstRequestData {
  const { nav, pct, dur, relMs } = ctx;
  const hasRedirect = (nav.redirectEnd ?? 0) > (nav.redirectStart ?? 0);
  const hasTls = (nav.secureConnectionStart ?? 0) > 0;
  const ttfbField = selectTtfbField(nav) as NavField;

  // ── Spans (colored bars) ───────────────────────────────────────────────────

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

  // ── Ticks (vertical markers) ───────────────────────────────────────────────

  const frTicks: DiagramTick[] = [];

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
      lane: ctx.laneCounter++ % 4,
      align: leftPct > 75 ? 'right' : 'left',
      group,
      color,
    };
  }

  for (const { field, group } of frTickFields(hasRedirect, hasTls)) {
    const tick = makeTick(field, group);
    if (tick) frTicks.push(tick);
  }

  // TTFB tick — amber, always shown
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
      lane: ctx.laneCounter++ % 4,
      align: ttfbLeftPct > 75 ? 'right' : 'left',
      color: COLOR.ttfb,
      group: 'TTFB',
    });
  }

  // ── Legend ─────────────────────────────────────────────────────────────────

  const frLegend: DiagramLegendItem[] = [
    ...frSpans.map(s => ({ label: s.label, ms: s.ms, color: s.color })),
    {
      label: 'TTFB',
      ms: ttfbMs,
      color: COLOR.ttfb,
      secondary: `(via ${ttfbField})`,
    },
  ];

  return {
    frSpans,
    frTicks,
    frLegend,
    ttfbMarker,
    ttfbField,
  };
}
