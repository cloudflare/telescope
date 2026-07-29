import { generate, ident, parse, walk } from 'css-tree';

import type { CssNode, WalkContext } from 'css-tree';
import type {
  CSSFeatureDetection,
  CSSFeatureSource,
  CSSSource,
} from './types.js';

// Requiring a leading letter intentionally excludes vendor-prefixed identifiers.
const BCD_SEGMENT_PATTERN = /^[a-z][a-z0-9-]*$/i;
const CSS_WIDE_KEYWORDS = new Set([
  'inherit',
  'initial',
  'revert',
  'revert-layer',
  'unset',
]);
const DESCRIPTOR_AT_RULES = new Set([
  'counter-style',
  'font-face',
  'font-palette-values',
  'function',
  'property',
]);
const PAGE_DESCRIPTORS = new Set(['page-orientation', 'size']);
// BCD preserves canonical casing for this small set of CSS keyword segments.
const VALUE_CANONICAL_CASE = new Map([
  ['currentcolor', 'currentColor'],
  ['geometricprecision', 'geometricPrecision'],
  ['linearrgb', 'linearRGB'],
  ['nan', 'NaN'],
  ['srgb', 'sRGB'],
]);

/**
 * Detect CSS properties and keyword values that can map to MDN Browser
 * Compatibility Data keys.
 *
 * Each syntax occurrence is retained so later analysis can aggregate its
 * source locations. Candidate keys that are not represented by web-features
 * are discarded by the separate Baseline status lookup stage.
 *
 * A stylesheet rejected by the parser is skipped without preventing other
 * sources from being analyzed. Recoverable malformed CSS is parsed on a
 * best-effort basis by css-tree.
 *
 * @param sources - CSS text and origin locations to analyze.
 * @returns Detected properties and single-keyword values in stylesheet
 *   traversal order.
 */
export function detectCSSFeatures(sources: CSSSource[]): CSSFeatureDetection[] {
  const detections: CSSFeatureDetection[] = [];

  for (const source of sources) {
    const atRuleStack: string[] = [];
    let ast: CssNode;
    try {
      ast = parse(source.css, { positions: true });
    } catch {
      continue;
    }

    walk(ast, {
      enter(this: WalkContext, node: CssNode) {
        if (node.type === 'Atrule') {
          atRuleStack.push(normalizeName(node.name) ?? '');
          return;
        }

        if (node.type !== 'Declaration' || this.atrulePrelude) return;

        if (atRuleStack.includes('font-feature-values')) return;

        const location = getSource(node, source.file);
        const decodedProperty = ident.decode(node.property);
        if (decodedProperty.startsWith('--')) {
          detections.push({
            type: 'property',
            bcdKey: 'css.properties.custom-property',
            property: decodedProperty,
            source: location,
          });
          return;
        }

        const property = normalizeName(decodedProperty);
        if (!property) return;

        const parentAtRule = atRuleStack.at(-1);
        const isDescriptor =
          parentAtRule &&
          (DESCRIPTOR_AT_RULES.has(parentAtRule) ||
            (parentAtRule === 'page' && PAGE_DESCRIPTORS.has(property)));
        if (isDescriptor) {
          detections.push({
            type: 'descriptor',
            atRule: parentAtRule,
            bcdKey: `css.at-rules.${parentAtRule}.${property}`,
            descriptor: property,
            source: location,
          });
          return;
        }

        detections.push({
          type: 'property',
          bcdKey: `css.properties.${property}`,
          property,
          source: location,
        });

        const value = normalizeValue(generate(node.value));
        if (!value) return;

        detections.push({
          type: 'property-value',
          bcdKey: CSS_WIDE_KEYWORDS.has(value)
            ? `css.types.global_keywords.${value}`
            : `css.properties.${property}.${value}`,
          property,
          source: getSource(node.value, source.file),
          value,
        });
      },
      leave(node: CssNode) {
        if (node.type === 'Atrule') atRuleStack.pop();
      },
    });
  }

  return detections;
}

function getSource(node: CssNode, file: string): CSSFeatureSource {
  return {
    file,
    line: node.loc?.start.line ?? 0,
  };
}

function normalizeName(name: string): string | null {
  const decodedName = ident.decode(name);
  if (!BCD_SEGMENT_PATTERN.test(decodedName)) return null;
  return decodedName.toLowerCase();
}

function normalizeValue(value: string): string | null {
  const decodedValue = ident.decode(value.trim());
  if (!BCD_SEGMENT_PATTERN.test(decodedValue)) return null;

  const lowerCaseValue = decodedValue.toLowerCase();
  return VALUE_CANONICAL_CASE.get(lowerCaseValue) ?? lowerCaseValue;
}
