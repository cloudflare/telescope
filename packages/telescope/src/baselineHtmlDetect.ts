import type { Page } from 'playwright';

import {
  ATTRIBUTE_BCD_NAMES,
  CUSTOM_DATA_ATTRIBUTE_BCD_KEY,
  GLOBAL_ATTRIBUTES,
  HTML_ELEMENT_ATTRIBUTES,
  VALUE_KEYS,
  VALUE_ONLY_ATTRIBUTES,
} from './baselineHtmlBcd.js';
import type { HTMLFeatureCount } from './types.js';

/**
 * Collect HTML element and attribute BCD keys from a page's live main-document
 * DOM. The following subtrees are not traversed, for distinct reasons:
 *
 * - `<template>` contents: inert and never rendered, so their features are not
 *   actually "in use" by the page — counting them would over-report.
 * - Shadow roots and same-origin child-frame documents: reachable and would
 *   give more complete coverage, but left out of this initial collector to keep
 *   its scope focused; candidates for a follow-up.
 * - Cross-origin child-frame documents: the browser blocks reading their DOM,
 *   so their features are not detectable from the main document at all.
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
      customDataAttributeBcdKey,
      elementAttributes,
      globalAttributes,
      valueKeys,
      valueOnlyAttributes,
    }) => {
      const globals = new Set<string>(globalAttributes);
      const valueOnly = new Set<string>(valueOnlyAttributes);
      const supportedElements = new Map(
        Object.entries(elementAttributes).map(([tag, attributeNames]) => [
          tag,
          new Set(attributeNames.length === 0 ? [] : attributeNames.split(',')),
        ]),
      );

      const getAttributeName = (attribute: Attr): string =>
        attribute.name.toLowerCase();

      const isCustomDataAttribute = (attribute: Attr): boolean => {
        const name = getAttributeName(attribute);
        return name.startsWith('data-') && name.length > 5;
      };

      const isIgnoredAttribute = (attribute: Attr): boolean => {
        const name = getAttributeName(attribute);
        return (
          name === 'role' || name.startsWith('aria-') || name.startsWith('on')
        );
      };

      const getAttributeKeys = (
        attribute: Attr,
        tag: string,
        supportedAttributes: Set<string> | undefined,
      ): string[] => {
        const name = getAttributeName(attribute);
        const value = attribute.value.toLowerCase();
        const ruleName = `${tag}.${name}`;

        if (globals.has(name)) {
          const globalRuleName = `global.${name}`;
          const valueKey = valueKeys[globalRuleName]?.[value];
          return [
            `html.global_attributes.${name}`,
            ...(valueKey ? [valueKey] : []),
          ];
        }

        if (!supportedAttributes) {
          return [];
        }

        const valueKey = valueKeys[ruleName]?.[value];
        if (valueOnly.has(ruleName)) {
          return valueKey ? [valueKey] : [];
        }

        if (!supportedAttributes.has(name)) {
          return [];
        }

        const bcdName = attributeBcdNames[ruleName] ?? name;
        return [
          `html.elements.${tag}.${bcdName}`,
          ...(valueKey ? [valueKey] : []),
        ];
      };

      const counts = [...document.querySelectorAll('*')]
        .filter(
          element => element.namespaceURI === 'http://www.w3.org/1999/xhtml',
        )
        .reduce((result, element) => {
          const tag = element.localName;
          const supportedAttributes = supportedElements.get(tag);
          const attributes = [...element.attributes];
          const customDataAttributeKeys = attributes
            .filter(isCustomDataAttribute)
            .map(() => customDataAttributeBcdKey);
          const elementKeys = new Set([
            ...(supportedAttributes ? [`html.elements.${tag}`] : []),
            ...attributes
              .filter(
                attribute =>
                  !isCustomDataAttribute(attribute) &&
                  !isIgnoredAttribute(attribute),
              )
              .flatMap(attribute =>
                getAttributeKeys(attribute, tag, supportedAttributes),
              ),
          ]);

          [...customDataAttributeKeys, ...elementKeys].forEach(bcdKey => {
            result.set(bcdKey, (result.get(bcdKey) ?? 0) + 1);
          });
          return result;
        }, new Map<string, number>());

      return [...counts.entries()]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([bcdKey, count]) => ({ bcdKey, count }));
    },
    {
      attributeBcdNames: ATTRIBUTE_BCD_NAMES,
      customDataAttributeBcdKey: CUSTOM_DATA_ATTRIBUTE_BCD_KEY,
      elementAttributes: HTML_ELEMENT_ATTRIBUTES,
      globalAttributes: GLOBAL_ATTRIBUTES,
      valueKeys: VALUE_KEYS,
      valueOnlyAttributes: VALUE_ONLY_ATTRIBUTES,
    },
  );
}
