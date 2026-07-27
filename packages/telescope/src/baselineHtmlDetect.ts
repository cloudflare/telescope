import type { Page } from 'playwright';

import { HTML_ELEMENT_ATTRIBUTES } from './baselineHtmlBcd.js';
import type { HTMLFeatureCount } from './types.js';

const GLOBAL_ATTRIBUTES = [
  'accesskey',
  'anchor',
  'autocapitalize',
  'autocorrect',
  'autofocus',
  'class',
  'contenteditable',
  'dir',
  'draggable',
  'enterkeyhint',
  'exportparts',
  'headingoffset',
  'headingreset',
  'hidden',
  'id',
  'inert',
  'inputmode',
  'is',
  'lang',
  'nonce',
  'part',
  'popover',
  'slot',
  'spellcheck',
  'style',
  'tabindex',
  'title',
  'translate',
  'virtualkeyboardpolicy',
  'writingsuggestions',
] as const;

const VALUE_KEYS: Record<string, Record<string, string>> = {
  'img.loading': {
    lazy: 'html.elements.img.loading',
  },
  'input.type': Object.fromEntries(
    [
      'button',
      'checkbox',
      'color',
      'date',
      'datetime-local',
      'email',
      'file',
      'hidden',
      'image',
      'month',
      'number',
      'password',
      'radio',
      'range',
      'reset',
      'search',
      'submit',
      'tel',
      'text',
      'time',
      'url',
      'week',
    ].map(value => [value, `html.elements.input.type_${value}`]),
  ),
};

const VALUE_ONLY_ATTRIBUTES = ['img.loading', 'input.type'] as const;

/**
 * Collect HTML element and attribute BCD keys from a page's live main-document
 * DOM. Shadow roots and child-frame documents are intentionally not pierced.
 *
 * @param page - A loaded Playwright page.
 * @returns Unique BCD keys sorted lexicographically with occurrence counts.
 */
export async function collectHTMLFeatures(
  page: Page,
): Promise<HTMLFeatureCount[]> {
  return page.evaluate(
    ({
      elementAttributes,
      globalAttributes,
      valueKeys,
      valueOnlyAttributes,
    }) => {
      const counts = new Map<string, number>();
      const globals = new Set<string>(globalAttributes);
      const valueOnly = new Set<string>(valueOnlyAttributes);

      const record = (bcdKey: string): void => {
        counts.set(bcdKey, (counts.get(bcdKey) ?? 0) + 1);
      };

      for (const element of document.querySelectorAll('*')) {
        if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
          continue;
        }

        const tag = element.localName;
        const attributeNames = elementAttributes[tag];
        if (attributeNames === undefined) continue;

        const supportedAttributes = new Set(
          attributeNames.length === 0 ? [] : attributeNames.split(','),
        );
        const elementKeys = new Set<string>([`html.elements.${tag}`]);

        for (const attribute of element.attributes) {
          const name = attribute.name.toLowerCase();
          const value = attribute.value.toLowerCase();
          let ruleName = `${tag}.${name}`;

          if (name.startsWith('data-')) {
            record('html.global_attributes.data_attributes');
            continue;
          }
          if (
            name === 'role' ||
            name.startsWith('aria-') ||
            name.startsWith('on')
          ) {
            continue;
          }

          if (globals.has(name)) {
            elementKeys.add(`html.global_attributes.${name}`);
            ruleName = `global.${name}`;
          } else if (!valueOnly.has(ruleName)) {
            if (!supportedAttributes.has(name)) continue;
            elementKeys.add(`html.elements.${tag}.${name}`);
          }

          const valueKey = valueKeys[ruleName]?.[value];
          if (valueKey) elementKeys.add(valueKey);
        }

        for (const key of elementKeys) record(key);
      }

      return [...counts.entries()]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([bcdKey, count]) => ({ bcdKey, count }));
    },
    {
      elementAttributes: HTML_ELEMENT_ATTRIBUTES,
      globalAttributes: GLOBAL_ATTRIBUTES,
      valueKeys: VALUE_KEYS,
      valueOnlyAttributes: VALUE_ONLY_ATTRIBUTES,
    },
  );
}
