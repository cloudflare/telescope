/**
 * Waterfall resource-type configuration.
 * Maps HAR _resourceType strings to visual bar heights and CSS color-token suffixes.
 */

export interface TypeConfig {
  /** Thick bar height in px */
  barH: number;
  /** CSS color-token suffix, e.g. "html" → --wf-html-light / --wf-html-dark */
  key: string;
}

/**
 * Maps resource-type key → CSS swatch/bar colour suffix.
 * Used by both the static renderer and the custom element to build filter chips.
 */
export const TYPE_SWATCH: Record<string, string> = {
  html: 'html',
  js: 'js',
  css: 'css',
  image: 'image',
  font: 'font',
  video: 'video',
  other: 'other',
};

/**
 * Display labels for filter chips — uppercase where conventional.
 * Falls back to the raw type key when not listed here.
 */
export const TYPE_LABEL: Record<string, string> = {
  html: 'HTML',
  js: 'JS',
  css: 'CSS',
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
  html: { barH: 16, key: 'html' },
  js: { barH: 16, key: 'js' },
  css: { barH: 16, key: 'css' },
  image: { barH: 16, key: 'image' },
  font: { barH: 16, key: 'font' },
  video: { barH: 16, key: 'video' },
};

const TYPE_DEFAULT: TypeConfig = { barH: 16, key: 'other' };

export function typeConfig(type: string): TypeConfig {
  return TYPE_CONFIG[type] ?? TYPE_DEFAULT;
}
