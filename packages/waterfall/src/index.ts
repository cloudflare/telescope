/**
 * @cloudflare/waterfall — HAR waterfall web component
 *
 * Exports the custom element class and all supporting types/helpers so
 * consumers can import them individually if needed.
 *
 * The CSS import below means bundler consumers (Vite, webpack, esbuild, …)
 * automatically pull in the stylesheet, and library-mode builds emit it
 * as dist/waterfall.css for drop-in consumers.
 */

import './waterfall.css';

export { WaterfallChart } from './waterfall-chart.js';
export { renderToHTML } from './render.js';
export { typeConfig, TYPE_SWATCH, TYPE_LABEL } from './config.js';
export type { TypeConfig } from './config.js';
export { fmtSize, fmtMs } from './formatters.js';
export {
  parseUrl,
  resourceType,
  isBlocking,
  computeTotalMs,
  uniqueTypes,
  pageEvents,
  fmtEventLabel,
} from './helpers.js';
export type {
  Har,
  HarLog,
  HarPage,
  HarEntry,
  HarRequest,
  HarResponse,
  HarTimings,
  HarContent,
  HarHeader,
  HarCookie,
  HarQueryParam,
  HarPostData,
  HarBrowser,
} from './har.js';
