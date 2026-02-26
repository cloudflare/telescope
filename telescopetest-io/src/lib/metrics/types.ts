/**
 * Structure of metrics.json from Telescope test results.
 * Matches the actual output written by testRunner.ts collectMetrics().
 */
export interface MetricsJson {
  navigationTiming?: {
    name?: string;
    entryType?: string;
    startTime?: number;
    duration?: number;
    initiatorType?: string;
    deliveryType?: string;
    nextHopProtocol?: string;
    renderBlockingStatus?: string;
    contentEncoding?: string;
    workerStart?: number;
    redirectStart?: number;
    redirectEnd?: number;
    fetchStart?: number;
    domainLookupStart?: number;
    domainLookupEnd?: number;
    connectStart?: number;
    connectEnd?: number;
    secureConnectionStart?: number;
    requestStart?: number;
    responseStart?: number;
    firstInterimResponseStart?: number;
    finalResponseHeadersStart?: number;
    responseEnd?: number;
    transferSize?: number;
    encodedBodySize?: number;
    decodedBodySize?: number;
    responseStatus?: number;
    serverTiming?: Array<{
      name: string;
      duration: number;
      description?: string;
    }>;
    unloadEventStart?: number;
    unloadEventEnd?: number;
    domInteractive?: number;
    domContentLoadedEventStart?: number;
    domContentLoadedEventEnd?: number;
    domComplete?: number;
    loadEventStart?: number;
    loadEventEnd?: number;
    type?: string;
    redirectCount?: number;
    activationStart?: number;
  };
  paintTiming?: Array<{
    name: string;
    entryType: string;
    startTime: number;
    duration: number;
  }>;
  userTiming?: Array<{
    name: string;
    entryType: 'mark' | 'measure';
    startTime: number;
    duration: number;
  }>;
  largestContentfulPaint?: Array<{
    name?: string;
    entryType?: string;
    startTime?: number;
    size?: number;
    url?: string;
    id?: string;
    loadTime?: number;
    renderTime?: number;
    element?: {
      nodeName?: string;
      outerHTML?: string;
      boundingRect?: {
        x: number;
        y: number;
        width: number;
        height: number;
        top: number;
        right: number;
        bottom: number;
        left: number;
      };
    };
  }>;
  layoutShifts?: Array<{
    name?: string;
    entryType?: string;
    startTime?: number;
    value?: number;
    hadRecentInput?: boolean;
    lastInputTime?: number;
  }>;
}
