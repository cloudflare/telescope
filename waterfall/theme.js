/**
 * theme.js — shared theme switcher for all three demo pages.
 *
 * The toggle has ☀️ on the left and 🌙 on the right.
 * - Unchecked = light theme forced
 * - Checked   = dark theme forced
 * - When the system default is active (no override) the checkbox reflects the
 *   current system preference but the toggle is not highlighted.
 * - When the user has explicitly chosen a theme (stored in localStorage) the
 *   toggle gains the `.theme-toggle--overridden` class to signal the override.
 * - Clicking the side that matches the current forced theme clears the override
 *   and returns to the system default.
 *
 * Persistence: localStorage key "wf-theme" stores "light" | "dark".
 * Application: sets/removes data-theme on <html>.
 */

(function () {
  const STORAGE_KEY = 'wf-theme';

  /** @returns {'light'|'dark'|null} null = follow system */
  function getStored() {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  }

  /** True if the system prefers dark right now. */
  function systemPrefersDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function applyTheme(override) {
    const root = document.documentElement;
    if (override === 'light') {
      root.setAttribute('data-theme', 'light');
    } else if (override === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }

  /**
   * Sync the checkbox position and overridden highlight.
   * @param {HTMLInputElement} checkbox
   * @param {HTMLElement} label
   * @param {'light'|'dark'|null} override
   */
  function syncUI(checkbox, label, override) {
    // Knob position: checked = dark side
    const effectiveDark =
      override === 'dark' || (override === null && systemPrefersDark());
    checkbox.checked = effectiveDark;

    // Highlight only when user has explicitly overridden the system default
    label.classList.toggle('theme-toggle--overridden', override !== null);
  }

  // Apply stored theme immediately (before first paint).
  let currentOverride = getStored();
  applyTheme(currentOverride);

  // Wire up the toggle once the DOM is ready.
  function init() {
    const checkbox = document.getElementById('theme-btn');
    if (!checkbox) return;
    const label = checkbox.closest('.theme-toggle');
    if (!label) return;

    syncUI(checkbox, label, currentOverride);

    // Use a click handler on the label so we can detect clicks on the already-
    // active side (a `change` event never fires when the value doesn't change).
    label.addEventListener('click', (e) => {
      // Let the browser handle the checkbox state change first.
      // We read checkbox.checked *after* the default action would flip it,
      // but since we call preventDefault and manage state manually, read the
      // *intended* target from the click position instead.
      e.preventDefault();

      // Determine which side the user clicked: dark if knob would go right.
      // We infer intent from the current knob position + click direction:
      // if already checked (dark), a click means "wants light"; if unchecked, "wants dark".
      // But if clicking the *same* side as the current override, clear it.
      const wantDark = !checkbox.checked;
      const intended = wantDark ? 'dark' : 'light';

      const systemDark = systemPrefersDark();
      const redundant =
        (intended === 'dark' && systemDark) ||
        (intended === 'light' && !systemDark);

      if (intended === currentOverride || redundant) {
        // Clicking the already-forced side, or forcing a theme that matches the
        // system default → remove override, return to system
        currentOverride = null;
        localStorage.removeItem(STORAGE_KEY);
      } else {
        currentOverride = intended;
        localStorage.setItem(STORAGE_KEY, currentOverride);
      }

      applyTheme(currentOverride);
      syncUI(checkbox, label, currentOverride);
    });

    // Keep knob in sync if system preference changes while no override is set.
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (currentOverride === null) {
          syncUI(checkbox, label, null);
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
