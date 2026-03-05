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
