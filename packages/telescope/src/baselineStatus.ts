/**
 * Baseline status lookup.
 *
 * Maps MDN Browser Compatibility Data (BCD) keys to their Baseline status using
 * the web-features package. This is a standalone, Node-side lookup; wiring it to
 * the HTML/CSS/JS feature detectors is handled in a later change.
 *
 * @see https://web.dev/baseline
 * @see https://www.npmjs.com/package/web-features
 */

import { features } from 'web-features';

import type {
  BaselineLookupResult,
  BaselineStatus,
  BaselineSupport,
  Discouraged,
} from './types.js';

type WebFeature = (typeof features)[string];

interface WebFeatureStatus {
  baseline: BaselineStatus;
  baseline_low_date?: string;
  baseline_high_date?: string;
  support: BaselineSupport;
}

/**
 * Reverse index from BCD key to its owning web-features feature ID.
 *
 * Built on the first lookup and reused thereafter. Only `kind: 'feature'`
 * entries carry compatibility data; `moved`/`split` redirect entries are
 * skipped.
 */
let bcdKeyToFeatureId: Map<string, string> | undefined;

/**
 * Look up the Baseline status of a single BCD key.
 *
 * Prefers web-features' per-compat-key status when present, falling back to the
 * feature-level status. The raw web-features classification is returned as-is,
 * with no reclassification.
 *
 * @param bcdKey - An MDN BCD key, e.g. `css.properties.display.grid`.
 * @returns The resolved Baseline status, or `null` when the key is unknown to
 *   web-features.
 */
export function lookupBaselineStatus(
  bcdKey: string,
): BaselineLookupResult | null {
  if (bcdKeyToFeatureId === undefined) {
    bcdKeyToFeatureId = new Map<string, string>();
    for (const [id, feature] of Object.entries(features)) {
      if (feature.kind !== 'feature') continue;
      for (const key of feature.compat_features ?? []) {
        bcdKeyToFeatureId.set(key, id);
      }
    }
  }

  const featureId: string | undefined = bcdKeyToFeatureId.get(bcdKey);
  if (featureId === undefined) return null;

  const feature: WebFeature | undefined = features[featureId];
  if (feature === undefined || feature.kind !== 'feature') return null;

  const status: WebFeatureStatus =
    feature.status.by_compat_key?.[bcdKey] ?? feature.status;

  return {
    featureId,
    featureName: feature.name,
    baseline: status.baseline,
    baselineLowDate: status.baseline_low_date ?? null,
    baselineHighDate: status.baseline_high_date ?? null,
    support: { ...status.support },
    ...(feature.discouraged && {
      discouraged: toDiscouraged(feature.discouraged),
    }),
  };
}

/** Map web-features discouraged metadata to our {@link Discouraged} type. */
function toDiscouraged(discouraged: {
  reason: string;
  according_to: string[];
  alternatives?: string[];
  removal_date?: string;
}): Discouraged {
  return {
    reason: discouraged.reason,
    according_to: [...discouraged.according_to],
    ...(discouraged.alternatives && {
      alternatives: [...discouraged.alternatives],
    }),
    ...(discouraged.removal_date && { removal_date: discouraged.removal_date }),
  };
}
