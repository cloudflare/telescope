import { describe, it, expect } from 'vitest';

import { lookupBaselineStatus } from '../src/baselineStatus.js';

// Pure unit tests: no browser is launched. Expected values are deterministic
// because the web-features version is pinned by the committed lockfile.
describe('lookupBaselineStatus', () => {
  it('returns high Baseline status for a Widely available feature key', () => {
    const result = lookupBaselineStatus('css.properties.display.grid');
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      featureId: 'grid',
      featureName: 'Grid',
      baseline: 'high',
      baselineLowDate: '2017-10-17',
      baselineHighDate: '2020-04-17',
    });
    expect(result?.support.chrome).toBeDefined();
  });

  it('returns low Baseline status with no high date for a Newly available feature key', () => {
    const result = lookupBaselineStatus('mediatypes.image.avif');
    expect(result).toMatchObject({
      featureId: 'avif',
      baseline: 'low',
      baselineLowDate: '2024-01-25',
      baselineHighDate: null,
    });
  });

  it('returns null for an unknown BCD key', () => {
    expect(lookupBaselineStatus('this.is.not.a.real.key')).toBeNull();
  });

  it('does not reclassify an unclassified (false) feature that is widely supported', () => {
    const result = lookupBaselineStatus('css.properties.accent-color');
    expect(result).toMatchObject({
      featureId: 'accent-color',
      baseline: false,
      baselineLowDate: null,
      baselineHighDate: null,
    });
    // Supported across all core browsers, yet must stay false: no heuristic promotion.
    expect(result?.support.chrome).toBeDefined();
    expect(result?.support.firefox).toBeDefined();
    expect(result?.support.safari).toBeDefined();
  });

  it('prefers per-compat-key status over the feature-level status', () => {
    // The `a` feature is Baseline high overall, but this specific key is not.
    const result = lookupBaselineStatus('html.elements.a.href.href_sms');
    expect(result).toMatchObject({ featureId: 'a', baseline: false });
  });

  it('maps discouraged metadata for a discouraged feature key', () => {
    const result = lookupBaselineStatus(
      'javascript.builtins.Object.defineGetter',
    );
    expect(result?.discouraged).toBeDefined();
    expect(result?.discouraged?.reason).toEqual(expect.any(String));
    expect(result?.discouraged?.according_to.length).toBeGreaterThan(0);
    expect(result?.discouraged?.alternatives).toBeUndefined();
    expect(result?.discouraged?.removal_date).toBeUndefined();
  });

  it('omits discouraged metadata for a non-discouraged feature key', () => {
    const result = lookupBaselineStatus('css.properties.display.grid');
    expect(result?.discouraged).toBeUndefined();
  });
});
