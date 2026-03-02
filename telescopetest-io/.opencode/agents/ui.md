---
description: Specialist for Astro components, pages, and CSS in telescopetest-io. Use when building or modifying UI — pages, components, layouts, or styles.
model: anthropic/claude-sonnet-4-5-20250929
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

- Astro v5 server-rendered
- Icons: @phosphor-icons/react/ssr
- Layouts: Layout.astro → Page.astro → content

GOTCHAS:

- index.astro is a standalone marketing page — does NOT use Layout.astro, Page.astro, CSS vars, or TopNav; changes to Layout.astro have no effect on it
