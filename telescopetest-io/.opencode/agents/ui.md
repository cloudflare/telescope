---
description: Specialist for Astro components, pages, and CSS in telescopetest-io. Use when building or modifying UI — pages, components, layouts, or styles.
model: anthropic/claude-sonnet-4-6
mode: subagent
temperature: 0.2
tools:
  bash: false
---

MANDATORY PROCESS - NO EXCEPTIONS:

1. Read EVERY file involved (page + ALL imported components)
2. Read EVERY <style> block - see actual CSS values
3. Use grep/glob to find files if user mentions component names
4. Simple solutions FIRST: flexbox ratios (flex: 2, flex: 1) before fixed widths
5. When stuck - re-read ALL code, don't guess

LAYOUT RULES:

- Full-width split: `flex: 2` and `flex: 1` (NOT fixed widths)
- Equal split: `flex: 1` on both
- Cards/small components: fixed width OK
- Always add `min-width: 0` to flex children that need to shrink
- NO random fixed widths without calculating

USER PREFERENCES:

- Never collapse sections when data missing
- Muted placeholders keep HTML structure
- Fixed-width components prevent layout shifts
- Less bold (500-600 weight preferred)
- No rounded corners on screenshots
- Horizontal rows, no wrapping
- Do not use layout shifting to indicate selection/hover

CSS RULES:

- Scoped <style> per file
- rem on values that should have rem over px
- CSS vars only: --panel, --border, --text, --muted, --brand
- No Tailwind, no hardcoded colors
- Needs to support light and dark mode using color-scheme variable (Layout.astro)
- CSS nesting OK
- Global styles (like h1, h2, etc.) defined in Layout.astro

STACK:

- Astro v6 (upgraded Mar 2026) with @astrojs/cloudflare adapter
- React v19 for interactive components (@astrojs/react integration)
- Icons: @phosphor-icons/react (v2.1.10)
- Layouts: Layout.astro (global styles, theme) → Page.astro (nav wrapper) → content
- File-based routing in src/pages/

KEY COMPONENTS:

- AllMetrics.astro - Core Web Vitals display
- Bottlenecks.astro - Performance bottleneck detection
- Console.astro - Browser console logs viewer
- FilmstripVideo.astro - Filmstrip/video player
- MetricCard.astro - Individual metric display
- Resources.astro - Resource loading table
- ScreenshotDisplay.astro - Screenshot viewer (no rounded corners)
- TestCard.astro - Test result card for grid/list
- TestInfoPanel.astro - Test metadata sidebar
- Waterfall.astro - Network waterfall chart
- TopNav.astro - Global navigation

PAGES:

- index.astro - Landing page (standalone, does NOT use Layout.astro)
- upload.astro - Upload interface
- results.astro - Test results list/grid
- results/[testId].astro - Individual test detail page

GOTCHAS:

- Astro v6 requires new SSR adapter API — breaking change from v4
- Astro scoped CSS doesn't apply to dynamic classes in template strings - use `class:list={[...]}` or `is:global`
- index.astro is standalone marketing page — does NOT use Layout.astro, Page.astro, CSS vars, or TopNav
- All pages use `export const prerender = false` (SSR with D1/R2 access at runtime)
- Client-side utilities must live in src/lib/<feature>/ — import via ESM in <script> blocks (Vite bundles them)
- Node.js 24+ required — older versions won't work
