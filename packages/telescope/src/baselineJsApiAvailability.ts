import type { Page } from 'playwright';

import { JS_API_REGISTRY } from './baselineJsApiRegistry.js';
import type { JSAPIRegistryEntry } from './types.js';

/**
 * Collects curated JavaScript and Web APIs available in an already-loaded page.
 * The lookup is read-only and isolates individual APIs whose property access
 * throws so they cannot prevent the rest of the registry from being checked.
 *
 * @param page - A Playwright page in the browser being inventoried.
 * @param registry - Registry to inspect; defaults to {@link JS_API_REGISTRY}.
 * @returns Sorted, deduplicated BCD keys for APIs available in the page.
 */
export async function collectAvailableJSAPIs(
  page: Page,
  registry: readonly JSAPIRegistryEntry[] = JS_API_REGISTRY,
): Promise<string[]> {
  return page.evaluate(entries => {
    const available = new Set<string>();

    for (const entry of entries) {
      try {
        const parts = entry.path.split('.');
        const property = parts.pop();
        let parent: unknown = globalThis;

        if (!property) continue;

        for (const part of parts) {
          if (
            parent === null ||
            (typeof parent !== 'object' && typeof parent !== 'function') ||
            !(part in parent)
          ) {
            parent = undefined;
            break;
          }
          parent = (parent as Record<string, unknown>)[part];
        }

        if (
          parent === null ||
          (typeof parent !== 'object' && typeof parent !== 'function') ||
          !(property in parent)
        ) {
          continue;
        }

        if (
          entry.kind === 'property' ||
          typeof (parent as Record<string, unknown>)[property] === 'function'
        ) {
          available.add(entry.bcdKey);
        }
      } catch {
        // Host objects may throw during lookup; availability is best-effort per API.
      }
    }

    return [...available].sort();
  }, registry);
}
