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

// HTML lowercases content-attribute names, but this BCD key is camel-cased.
const ATTRIBUTE_BCD_NAMES: Record<string, string> = {
  'iframe.privatetoken': 'privateToken',
};

/**
 * Collect HTML element and attribute BCD keys from a page's live main-document
 * DOM. Shadow roots, child-frame documents, and inert `<template>` contents
 * are intentionally not pierced.
 *
 * @param page - A loaded Playwright page.
 * @returns Unique BCD keys sorted lexicographically with occurrence counts.
 */
export async function collectHTMLFeatures(
  page: Page,
): Promise<HTMLFeatureCount[]> {
  return page.evaluate(
    ({
      attributeBcdNames,
      elementAttributes,
      globalAttributes,
      valueKeys,
      valueOnlyAttributes,
    }) => {
      const counts = new Map<string, number>();
      const globals = new Set<string>(globalAttributes);
      const valueOnly = new Set<string>(valueOnlyAttributes);
      const supportedElements = new Map(
        Object.entries(elementAttributes).map(([tag, attributeNames]) => [
          tag,
          new Set(attributeNames.length === 0 ? [] : attributeNames.split(',')),
        ]),
      );

      const record = (bcdKey: string): void => {
        counts.set(bcdKey, (counts.get(bcdKey) ?? 0) + 1);
      };

      for (const element of document.querySelectorAll('*')) {
        if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
          continue;
        }

        const tag = element.localName;
        const supportedAttributes = supportedElements.get(tag);
        const elementKeys = new Set<string>();
        if (supportedAttributes) elementKeys.add(`html.elements.${tag}`);

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
          } else if (supportedAttributes && !valueOnly.has(ruleName)) {
            if (!supportedAttributes.has(name)) continue;
            const bcdName = attributeBcdNames[ruleName] ?? name;
            elementKeys.add(`html.elements.${tag}.${bcdName}`);
          } else if (!supportedAttributes) {
            continue;
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
      attributeBcdNames: ATTRIBUTE_BCD_NAMES,
      elementAttributes: HTML_ELEMENT_ATTRIBUTES,
      globalAttributes: GLOBAL_ATTRIBUTES,
      valueKeys: VALUE_KEYS,
      valueOnlyAttributes: VALUE_ONLY_ATTRIBUTES,
    },
  );
}
