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

const TYPE_CONFIG: Record<string, TypeConfig> = {
  document: { barH: 14, key: 'html' },
  script: { barH: 10, key: 'js' },
  stylesheet: { barH: 10, key: 'css' },
  image: { barH: 12, key: 'image' },
  font: { barH: 8, key: 'font' },
  video: { barH: 12, key: 'video' },
};

const TYPE_DEFAULT: TypeConfig = { barH: 8, key: 'other' };

export function typeConfig(type: string): TypeConfig {
  return TYPE_CONFIG[type] ?? TYPE_DEFAULT;
}
