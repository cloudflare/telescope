import type { JSAPIKind, JSAPIRegistryEntry } from './types.js';

function api(
  bcdKey: string,
  kind: JSAPIKind,
  path: string,
): JSAPIRegistryEntry {
  return { bcdKey, kind, path };
}

/**
 * Curated JavaScript and Web APIs whose browser availability is relevant to
 * Baseline analysis. This registry covers APIs selected for reliable runtime
 * detection; it does not mirror the complete BCD dataset. Add APIs when they
 * are commonly used and can be detected safely and reliably.
 *
 * Paths start at the page's `globalThis` object. Each BCD key describes the
 * exact exposure at its path, not merely the interface type returned by that
 * exposure.
 */
export const JS_API_REGISTRY: readonly JSAPIRegistryEntry[] = [
  // Animation
  api('api.Animation', 'constructor', 'Animation'),
  api('api.Element.animate', 'method', 'Element.prototype.animate'),
  api('api.KeyframeEffect', 'constructor', 'KeyframeEffect'),
  api('api.ScrollTimeline', 'constructor', 'ScrollTimeline'),
  api('api.ViewTimeline', 'constructor', 'ViewTimeline'),

  // Clipboard
  api('api.Navigator.clipboard', 'property', 'navigator.clipboard'),
  api('api.Clipboard.readText', 'method', 'navigator.clipboard.readText'),
  api('api.Clipboard.writeText', 'method', 'navigator.clipboard.writeText'),

  // Crypto
  api('api.Crypto.randomUUID', 'method', 'crypto.randomUUID'),
  api('api.Crypto.subtle', 'property', 'crypto.subtle'),

  // DOM and elements
  api(
    'api.Document.adoptedStyleSheets',
    'property',
    'Document.prototype.adoptedStyleSheets',
  ),
  api(
    'api.Element.checkVisibility',
    'method',
    'Element.prototype.checkVisibility',
  ),
  api('api.Element.getAnimations', 'method', 'Element.prototype.getAnimations'),
  api(
    'api.Element.scrollIntoView',
    'method',
    'Element.prototype.scrollIntoView',
  ),
  api('api.HTMLDialogElement', 'constructor', 'HTMLDialogElement'),
  api(
    'api.HTMLTemplateElement.shadowRootMode',
    'property',
    'HTMLTemplateElement.prototype.shadowRootMode',
  ),

  // Encoding
  api('api.TextDecoder', 'constructor', 'TextDecoder'),
  api('api.TextDecoderStream', 'constructor', 'TextDecoderStream'),
  api('api.TextEncoder', 'constructor', 'TextEncoder'),
  api('api.TextEncoderStream', 'constructor', 'TextEncoderStream'),

  // Geolocation and sensors
  api('api.Navigator.geolocation', 'property', 'navigator.geolocation'),

  // JavaScript built-ins
  api('javascript.builtins.AggregateError', 'constructor', 'AggregateError'),
  api('javascript.builtins.Array.at', 'method', 'Array.prototype.at'),
  api(
    'javascript.builtins.Array.findLast',
    'method',
    'Array.prototype.findLast',
  ),
  api(
    'javascript.builtins.Array.findLastIndex',
    'method',
    'Array.prototype.findLastIndex',
  ),
  api('javascript.builtins.Array.flat', 'method', 'Array.prototype.flat'),
  api('javascript.builtins.Array.flatMap', 'method', 'Array.prototype.flatMap'),
  api(
    'javascript.builtins.Array.fromAsync',
    'static_method',
    'Array.fromAsync',
  ),
  api(
    'javascript.builtins.Array.toReversed',
    'method',
    'Array.prototype.toReversed',
  ),
  api(
    'javascript.builtins.Array.toSorted',
    'method',
    'Array.prototype.toSorted',
  ),
  api(
    'javascript.builtins.Array.toSpliced',
    'method',
    'Array.prototype.toSpliced',
  ),
  api('javascript.builtins.Array.with', 'method', 'Array.prototype.with'),
  api(
    'javascript.builtins.FinalizationRegistry',
    'constructor',
    'FinalizationRegistry',
  ),
  api('javascript.builtins.globalThis', 'property', 'globalThis'),
  api(
    'javascript.builtins.Intl.DisplayNames',
    'constructor',
    'Intl.DisplayNames',
  ),
  api('javascript.builtins.Intl.ListFormat', 'constructor', 'Intl.ListFormat'),
  api(
    'javascript.builtins.Intl.RelativeTimeFormat',
    'constructor',
    'Intl.RelativeTimeFormat',
  ),
  api('javascript.builtins.Intl.Segmenter', 'constructor', 'Intl.Segmenter'),
  api('javascript.builtins.Iterator.from', 'static_method', 'Iterator.from'),
  api('javascript.builtins.Map.groupBy', 'static_method', 'Map.groupBy'),
  api('javascript.builtins.Object.groupBy', 'static_method', 'Object.groupBy'),
  api('javascript.builtins.Object.hasOwn', 'static_method', 'Object.hasOwn'),
  api(
    'javascript.builtins.Promise.allSettled',
    'static_method',
    'Promise.allSettled',
  ),
  api('javascript.builtins.Promise.any', 'static_method', 'Promise.any'),
  api(
    'javascript.builtins.Promise.withResolvers',
    'static_method',
    'Promise.withResolvers',
  ),
  api('api.queueMicrotask', 'global_function', 'queueMicrotask'),
  api(
    'javascript.builtins.Set.difference',
    'method',
    'Set.prototype.difference',
  ),
  api(
    'javascript.builtins.Set.intersection',
    'method',
    'Set.prototype.intersection',
  ),
  api(
    'javascript.builtins.Set.isSubsetOf',
    'method',
    'Set.prototype.isSubsetOf',
  ),
  api('javascript.builtins.Set.union', 'method', 'Set.prototype.union'),
  api('javascript.builtins.String.at', 'method', 'String.prototype.at'),
  api(
    'javascript.builtins.String.replaceAll',
    'method',
    'String.prototype.replaceAll',
  ),
  api('javascript.builtins.WeakRef', 'constructor', 'WeakRef'),

  // Media
  api('api.MediaRecorder', 'constructor', 'MediaRecorder'),
  api('api.Navigator.mediaSession', 'property', 'navigator.mediaSession'),
  api('api.MediaSource', 'constructor', 'MediaSource'),

  // Network and fetch
  api('api.AbortController', 'constructor', 'AbortController'),
  api('api.AbortSignal.any_static', 'static_method', 'AbortSignal.any'),
  api('api.AbortSignal.timeout_static', 'static_method', 'AbortSignal.timeout'),
  api('api.EventSource', 'constructor', 'EventSource'),
  api('api.Headers', 'constructor', 'Headers'),
  api('api.Navigator.sendBeacon', 'method', 'navigator.sendBeacon'),
  api('api.Request', 'constructor', 'Request'),
  api('api.Response', 'constructor', 'Response'),
  api('api.WebSocket', 'constructor', 'WebSocket'),
  api('api.fetch', 'global_function', 'fetch'),
  api('api.XMLHttpRequest', 'constructor', 'XMLHttpRequest'),

  // Notifications and permissions
  api('api.Notification', 'constructor', 'Notification'),
  api('api.Navigator.permissions', 'property', 'navigator.permissions'),

  // Observers
  api('api.IntersectionObserver', 'constructor', 'IntersectionObserver'),
  api('api.MutationObserver', 'constructor', 'MutationObserver'),
  api('api.PerformanceObserver', 'constructor', 'PerformanceObserver'),
  api('api.ReportingObserver', 'constructor', 'ReportingObserver'),
  api('api.ResizeObserver', 'constructor', 'ResizeObserver'),

  // Performance and timing
  api('api.Performance.mark', 'method', 'performance.mark'),
  api('api.Performance.measure', 'method', 'performance.measure'),
  api('api.Performance.now', 'method', 'performance.now'),

  // Scheduling
  api('api.IdleDetector', 'constructor', 'IdleDetector'),
  api('api.scheduler', 'property', 'scheduler'),

  // Service workers
  api('api.Navigator.serviceWorker', 'property', 'navigator.serviceWorker'),

  // Storage and cache
  api('api.caches', 'property', 'caches'),
  api('api.indexedDB', 'property', 'indexedDB'),
  api('api.Navigator.storage', 'property', 'navigator.storage'),

  // Streams
  api('api.CompressionStream', 'constructor', 'CompressionStream'),
  api('api.DecompressionStream', 'constructor', 'DecompressionStream'),
  api('api.ReadableStream', 'constructor', 'ReadableStream'),
  api('api.TransformStream', 'constructor', 'TransformStream'),
  api('api.WritableStream', 'constructor', 'WritableStream'),

  // URL and navigation
  api('api.Window.navigation', 'property', 'navigation'),
  api('api.URL', 'constructor', 'URL'),
  api('api.URLPattern', 'constructor', 'URLPattern'),
  api('api.URLSearchParams', 'constructor', 'URLSearchParams'),

  // View transitions
  api(
    'api.Document.startViewTransition',
    'method',
    'document.startViewTransition',
  ),

  // Web workers and messaging
  api('api.BroadcastChannel', 'constructor', 'BroadcastChannel'),
  api('api.MessageChannel', 'constructor', 'MessageChannel'),
  api('api.SharedWorker', 'constructor', 'SharedWorker'),
  api('api.Worker', 'constructor', 'Worker'),

  // Global functions
  api('api.structuredClone', 'global_function', 'structuredClone'),
];
