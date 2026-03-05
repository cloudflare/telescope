/**
 * Server timing entry from Performance API
 */
export interface ServerTiming {
  name: string;
  description?: string;
  duration: number;
}

/**
 * Navigation timing from Performance API
 * Extended with additional browser-specific fields
 */
export interface NavigationTiming {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  // Core timing fields
  navigationStart?: number; // usually 0
  unloadEventStart: number;
  unloadEventEnd: number;
  redirectStart: number;
  redirectEnd: number;
  fetchStart: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  secureConnectionStart: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  domLoading?: number;
  domInteractive: number;
  domContentLoadedEventStart: number;
  domContentLoadedEventEnd: number;
  domComplete: number;
  loadEventStart: number;
  loadEventEnd: number;
  serverTiming?: ServerTiming[];
  // Extended browser fields
  initiatorType?: string;
  deliveryType?: string;
  nextHopProtocol?: string;
  renderBlockingStatus?: string;
  contentEncoding?: string;
  workerStart?: number;
  transferSize?: number;
  encodedBodySize?: number;
  decodedBodySize?: number;
  responseStatus?: number;
  type?: string;
  redirectCount?: number;
  activationStart?: number;
  // Chromium-specific timings
  firstInterimResponseStart?: number;
  finalResponseHeadersStart?: number;
}

/**
 * Paint timing entry from Performance API
 */
export interface PaintTiming {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
}

/**
 * User timing entry (mark or measure)
 */
export interface UserTiming {
  name: string;
  entryType: 'mark' | 'measure';
  startTime: number;
  duration: number;
}

/**
 * Bounding rectangle for LCP element
 */
export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * LCP element details
 */
export interface LCPElement {
  nodeName?: string;
  boundingRect?: BoundingRect;
  outerHTML?: string;
  src?: string;
  currentSrc?: string;
  'background-image'?: string;
  content?: string;
}

/**
 * Largest Contentful Paint event
 */
export interface LCPEvent {
  name?: string;
  entryType?: string;
  startTime: number;
  size: number;
  url?: string;
  id?: string;
  loadTime?: number;
  renderTime?: number;
  element?: LCPElement;
}

/**
 * Layout shift source rect
 */
export interface LayoutShiftSourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Layout shift source
 */
export interface LayoutShiftSource {
  previousRect: LayoutShiftSourceRect;
  currentRect: LayoutShiftSourceRect;
}

/**
 * Layout shift event from Performance API
 */
export interface LayoutShift {
  name?: string;
  entryType?: string;
  startTime: number;
  value: number;
  hadRecentInput?: boolean;
  lastInputTime?: number;
  sources?: LayoutShiftSource[];
}

// ── Navigation Timing diagram types ───────────────────────────────────────────

/**
 * A vertical tick mark in the Navigation Timing diagram.
 * `align` controls whether the label hangs to the right ('left') or left ('right') of the stem.
 */
export type DiagramTick = {
  field: string;
  leftPct: number;
  msRel: number;
  lane: number;
  align: 'left' | 'right';
  color?: string;
  group?: string;
};

/** A coloured horizontal bar segment in the First Request bar. */
export type DiagramSpan = {
  label: string;
  ms: number;
  leftPct: number;
  widthPct: number;
  color: string;
};

/** A coloured horizontal bar segment in the Page-scoped bar. */
export type DiagramPageSeg = {
  label: string;
  ms: number;
  leftPct: number;
  widthPct: number;
  bg: string; // may be a CSS gradient string
};

/** One item in the diagram legend. */
export type DiagramLegendItem = {
  label: string;
  ms: number;
  color: string;
  note?: string;
  secondary?: string;
};

/** All computed data needed to render the Navigation Timing diagram. */
export type NavTimingDiagram = {
  totalMs: number;
  frTicks: DiagramTick[];
  pageTicks: DiagramTick[];
  frSpans: DiagramSpan[];
  pageSegs: DiagramPageSeg[];
  frLegend: DiagramLegendItem[];
  pageLegend: DiagramLegendItem[];
  ttfbMarker: { leftPct: number; ms: number } | null;
  ttfbField: string;
  hasFuzzyDom: boolean;
  navTimestampRows: { field: string; msRel: number; note?: string }[];
};

/**
 * Structure of metrics.json from Telescope test results.
 * Matches the actual output written by testRunner.ts collectMetrics().
 */
export interface MetricsJson {
  navigationTiming?: NavigationTiming;
  paintTiming?: PaintTiming[];
  userTiming?: UserTiming[];
  largestContentfulPaint?: LCPEvent[];
  layoutShifts?: LayoutShift[];
}
