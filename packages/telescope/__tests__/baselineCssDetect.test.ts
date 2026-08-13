import { describe, expect, it } from 'vitest';

import { detectCSSFeatures } from '../src/baselineCssDetect.js';

const TEST_FILE = 'test.css';

function detectKeys(css: string): string[] {
  return detectCSSFeatures([{ css, file: TEST_FILE }]).map(
    detection => detection.bcdKey,
  );
}

describe('detectCSSFeatures', () => {
  it('detects properties and single-keyword values with their source lines', () => {
    const detections = detectCSSFeatures([
      {
        css: '.card {\n  display: grid;\n  color: var(--brand);\n}',
        file: 'https://example.com/styles.css',
      },
    ]);

    expect(detections).toEqual([
      {
        type: 'property',
        bcdKey: 'css.properties.display',
        property: 'display',
        source: { file: 'https://example.com/styles.css', line: 2 },
      },
      {
        type: 'property-value',
        bcdKey: 'css.properties.display.grid',
        property: 'display',
        value: 'grid',
        source: { file: 'https://example.com/styles.css', line: 2 },
      },
      {
        type: 'property',
        bcdKey: 'css.properties.color',
        property: 'color',
        source: { file: 'https://example.com/styles.css', line: 3 },
      },
    ]);
  });

  it('normalizes case for case-insensitive CSS names and values', () => {
    expect(detectKeys('a { DISPLAY: GRID; }')).toEqual([
      'css.properties.display',
      'css.properties.display.grid',
    ]);
  });

  it.each([
    ['color', 'CURRENTCOLOR', 'currentColor'],
    ['text-rendering', 'GEOMETRICPRECISION', 'geometricPrecision'],
    ['color-interpolation', 'LINEARRGB', 'linearRGB'],
    ['color-interpolation', 'SRGB', 'sRGB'],
  ])('preserves canonical BCD casing for %s: %s', (property, value, key) => {
    expect(detectKeys(`a { ${property}: ${value}; }`)).toEqual([
      `css.properties.${property}`,
      `css.properties.${property}.${key}`,
    ]);
  });

  it('does not rewrite values that only resemble canonical BCD segments', () => {
    expect(detectKeys('a { color-interpolation: lineargradient; }')).toEqual([
      'css.properties.color-interpolation',
      'css.properties.color-interpolation.lineargradient',
    ]);
  });

  it('maps CSS-wide keywords through their shared BCD namespace', () => {
    expect(detectKeys('a { color: REVERT-LAYER; }')).toEqual([
      'css.properties.color',
      'css.types.global_keywords.revert-layer',
    ]);
  });

  it('does not treat conditional-query operands as applied declarations', () => {
    expect(detectKeys('@supports (display: grid) {}')).toEqual([]);
    expect(
      detectKeys('@supports (display: grid) { a { display: grid; } }'),
    ).toEqual(['css.properties.display', 'css.properties.display.grid']);
  });

  it('maps descriptors through their containing at-rule', () => {
    const css = [
      '@font-face { font-display: swap; }',
      '@property --brand { syntax: "<color>"; inherits: false; }',
      '@counter-style thumbs { system: cyclic; }',
      '@page { size: a4; }',
      '@media (width > 1px) { a { display: grid; } }',
    ].join('\n');

    expect(detectKeys(css)).toEqual([
      'css.at-rules.font-face.font-display',
      'css.at-rules.property.syntax',
      'css.at-rules.property.inherits',
      'css.at-rules.counter-style.system',
      'css.at-rules.page.size',
      'css.properties.display',
      'css.properties.display.grid',
    ]);
  });

  it('distinguishes page descriptors from properties applied to a page', () => {
    const detections = detectCSSFeatures([
      {
        css: '@page { size: a4; page-orientation: upright; margin: 1cm; color: black; }',
        file: 'page.css',
      },
    ]);

    expect(detections.map(({ type, bcdKey }) => [type, bcdKey])).toEqual([
      ['descriptor', 'css.at-rules.page.size'],
      ['descriptor', 'css.at-rules.page.page-orientation'],
      ['property', 'css.properties.margin'],
      ['property', 'css.properties.color'],
      ['property-value', 'css.properties.color.black'],
    ]);
  });

  it('does not treat named font feature values as properties', () => {
    expect(
      detectKeys('@font-feature-values Font { @styleset { nice: 1; } }'),
    ).toEqual([]);
  });

  it('reports newer descriptor at-rules with their source locations', () => {
    const detections = detectCSSFeatures([
      {
        css: [
          '@font-palette-values --brand { base-palette: 1; }',
          '@function --double(--value) { result: calc(var(--value) * 2); }',
        ].join('\n'),
        file: 'descriptors.css',
      },
    ]);

    expect(detections).toEqual([
      {
        type: 'descriptor',
        atRule: 'font-palette-values',
        bcdKey: 'css.at-rules.font-palette-values.base-palette',
        descriptor: 'base-palette',
        source: { file: 'descriptors.css', line: 1 },
      },
      {
        type: 'descriptor',
        atRule: 'function',
        bcdKey: 'css.at-rules.function.result',
        descriptor: 'result',
        source: { file: 'descriptors.css', line: 2 },
      },
    ]);
  });

  it('decodes escaped CSS identifiers before producing BCD keys', () => {
    expect(detectKeys('a { d\\69 splay: g\\72 id; }')).toEqual([
      'css.properties.display',
      'css.properties.display.grid',
    ]);
  });

  it('maps custom properties to their generic key and ignores vendor prefixes', () => {
    expect(
      detectKeys(
        ':root { --columns: 3; -webkit-box-align: center; display: var(--display); }',
      ),
    ).toEqual([
      'css.properties.custom-property',
      'css.properties.display',
    ]);
  });

  it('reports a property value on the line where its value starts', () => {
    const detections = detectCSSFeatures([
      { css: 'a {\n  color:\n    currentColor;\n}', file: 'multiline.css' },
    ]);

    expect(detections.map(detection => detection.source.line)).toEqual([2, 3]);
  });

  it('keeps separate occurrences of the same feature', () => {
    const keys = detectKeys(
      '.first { display: grid; }\n.second { display: grid; }',
    );

    expect(keys.filter(key => key === 'css.properties.display')).toHaveLength(2);
  });

  it('continues with other sources when one stylesheet contains malformed CSS', () => {
    const detections = detectCSSFeatures([
      { css: 'a { content: "unterminated; }', file: 'broken.css' },
      { css: 'a { display: block; }', file: 'valid.css' },
    ]);

    expect(detections).toContainEqual({
      type: 'property-value',
      bcdKey: 'css.properties.display.block',
      property: 'display',
      value: 'block',
      source: { file: 'valid.css', line: 1 },
    });
  });

  it('returns no detections when there are no CSS sources', () => {
    expect(detectCSSFeatures([])).toEqual([]);
  });
});
