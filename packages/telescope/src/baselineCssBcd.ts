/**
 * CSS names that require special handling when constructing MDN Browser
 * Compatibility Data keys.
 */

// Requiring a leading letter intentionally excludes vendor-prefixed identifiers.
export const BCD_SEGMENT_PATTERN = /^[a-z][a-z0-9-]*$/i;

export const CSS_WIDE_KEYWORDS: ReadonlySet<string> = new Set([
  'inherit',
  'initial',
  'revert',
  'revert-layer',
  'unset',
]);

export const DESCRIPTOR_AT_RULES: ReadonlySet<string> = new Set([
  'counter-style',
  'font-face',
  'font-palette-values',
  'function',
  'property',
]);

export const PAGE_DESCRIPTORS: ReadonlySet<string> = new Set([
  'page-orientation',
  'size',
]);

// BCD preserves canonical casing for this small set of CSS keyword segments.
export const VALUE_CANONICAL_CASE: ReadonlyMap<string, string> = new Map([
  ['currentcolor', 'currentColor'],
  ['geometricprecision', 'geometricPrecision'],
  ['linearrgb', 'linearRGB'],
  ['nan', 'NaN'],
  ['srgb', 'sRGB'],
]);
