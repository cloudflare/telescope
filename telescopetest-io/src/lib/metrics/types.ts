/**
 * Structure of metrics.json from Telescope test results
 */
export interface MetricsJson {
  navigationTiming?: {
    navigationStart?: number;
    responseStart?: number;
    responseEnd?: number;
    transferSize?: number;
    encodedBodySize?: number;
    duration?: number;
    firstInterimResponseStart?: number;
    finalResponseHeadersStart?: number;
  };
  paintTiming?: Array<{ name: string; startTime: number }>;
  largestContentfulPaint?: Array<{ startTime?: number }>;
  layoutShifts?: Array<{ value?: number }>;
}
