# `<waterfall-chart>` web component

A self-contained, framework-free web component that renders an HTTP Archive
(HAR) waterfall chart. Styling lives in a standalone `waterfall.css` — link it
in `<head>` and the chart renders correctly with or without JavaScript.

## Usage

### 1. Static (CSS-only, no JavaScript)

Pre-render the chart at build time with `renderToHTML()` and drop the output
inside `<waterfall-chart>`. The element renders entirely from HTML + CSS — no
JS bundle required.

```html
<link rel="stylesheet" href="/waterfall/waterfall.css" />

<waterfall-chart>
  <!-- output of renderToHTML(har) -->
</waterfall-chart>
```

```js
// build script (Node.js)
import { renderToHTML } from '@telescope/waterfall';
import har from './pageload.har' assert { type: 'json' };

const html = renderToHTML(har);
// inject html between <waterfall-chart> tags in your HTML template
```

### 2. Progressive enhancement

Same pre-rendered children, but load the JS bundle lazily. The element upgrades
in place, wiring up interactivity (resource-type filter chips, row click → detail
panel, column toggle, timeline scrubber) without re-rendering.

```html
<link rel="stylesheet" href="/waterfall/waterfall.css" />
<script type="module" src="/waterfall/dist/index.js"></script>

<waterfall-chart>
  <!-- pre-rendered children -->
</waterfall-chart>
```

### 3. Fully dynamic (JS-driven)

Supply HAR data via the `src` attribute (fetched) or the `.har` JS property.
The element builds its own DOM from scratch.

```html
<link rel="stylesheet" href="/waterfall/waterfall.css" />
<script type="module" src="/waterfall/dist/index.js"></script>

<!-- fetch from a URL -->
<waterfall-chart src="/api/tests/abc123/pageload.har"></waterfall-chart>
```

```js
// or set a HAR object programmatically
const el = document.querySelector('waterfall-chart');
el.har = harObject;
```

Changing the `src` attribute or reassigning `.har` triggers a full re-render.

## Interactivity (JS mode)

When the JS bundle is loaded the element gains:

- **Resource-type filter chips** — click `all`, `html`, `js`, `css`, `image`,
  `font`, `video`, `other` to show only matching rows. Multiple types can be
  active simultaneously; clicking the active type deactivates it.
- **Column toggle** — "Show columns" / "Hide columns" button expands/collapses
  the Method, Protocol, Status, Type, Size, and Duration columns.
- **Timeline scrubber** — hover over the waterfall to see a vertical line
  labelled with the time in ms. The scrubber snaps to event lines (DCL, Load,
  LCP) and displays the full label (name + value) when within 8 px.
- **Detail panel** — click any row to open a panel with timings, headers, and
  general request/response info. Click again or use the × button to close.

## Theming

All colours are CSS custom properties on `:root`. Override them on any ancestor
(or on `waterfall-chart` itself) to theme the component:

```css
waterfall-chart {
  --wf-brand: #7c3aed;
  --wf-text: #f9fafb;
  --wf-muted: #9ca3af;
  --wf-bg: #111827;
  --wf-panel: #1f2937;
  --wf-border: #374151;
  --wf-grid: #2a2a2a;
}
```

Resource-type bars (`--wf-html-light` / `--wf-html-dark`, etc.), connection
phase bars (`--wf-dns`, `--wf-connect`, …), and event-line colours
(`--wf-ev-dcl`, `--wf-ev-load`, `--wf-ev-lcp`) can all be overridden the same
way.

### Dark mode

`waterfall.css` responds to `prefers-color-scheme: dark` automatically. To
override the system setting, set `data-theme="light"` or `data-theme="dark"` on
`<html>` (or any ancestor). The `theme.js` helper does this and persists the
choice to `localStorage`.

```js
document.documentElement.setAttribute('data-theme', 'dark');
```

## Package layout

```
waterfall/
├── src/
│   ├── har.ts              HAR 1.2 TypeScript types
│   ├── config.ts           Resource-type → bar-height / colour-key map
│   ├── formatters.ts       fmtSize / fmtMs helpers
│   ├── helpers.ts          Pure analysis helpers (parseUrl, resourceType, …)
│   ├── render.ts           renderToHTML(har) — pure server/build-time renderer
│   ├── waterfall-chart.ts  Custom element implementation
│   └── index.ts            Barrel export
├── __tests__/
│   ├── helpers.ts          Shared test utilities
│   ├── theme.test.ts       Theme / color-scheme tests
│   ├── toggle.test.ts      Column-toggle and theme-toggle tests
│   └── overlay.test.ts     Event-line label and scrubber tests
├── dist/                   Compiled JS + type declarations (after build)
├── scripts/
│   └── gen-demo.js         Regenerates pre-rendered HTML in demo pages
��── waterfall.css           Standalone stylesheet — link in <head>
├── demo.css                Demo page styles (page chrome only)
├── static.html             Demo: pure HTML+CSS, no JS
├── progressive.html        Demo: pre-rendered + lazy JS upgrade
├── index.html              Demo: fully dynamic, URL input + file picker
├── theme.js                Sun/moon theme toggle helper (localStorage + data-theme)
├── vitest.config.ts        Vitest configuration
├── package.json
└── tsconfig.json
```

waterfall/
├── src/
│ ├── har.ts HAR 1.2 TypeScript types
│ ├── config.ts Resource-type → bar-height / colour-key map
│ ├── formatters.ts fmtSize / fmtMs helpers
│ ├── helpers.ts Pure analysis helpers (parseUrl, computeTotalMs, …)
│ ├── render.ts renderToHTML(har) — pure server/build-time renderer
│ ├── waterfall-chart.ts Custom element implementation
│ └── index.ts Barrel export
├── **tests**/
│ └── theme.test.ts Playwright-driven visual/theme tests (Vitest)
├── dist/ Compiled JS + type declarations (after build)
├── scripts/
│ └── gen-demo.js Regenerates pre-rendered HTML in demo pages
├── waterfall.css Standalone stylesheet — link in <head>
├── demo.css Demo page styles
├── static.html Demo: pure HTML+CSS, no JS
├── progressive.html Demo: pre-rendered + lazy JS upgrade
├── index.html Demo: fully dynamic, URL input + file picker
├── theme.js Sun/Moon theme toggle helper
├── vitest.config.ts Vitest configuration
├── package.json
└── tsconfig.json

````

## Building and testing

```bash
npm install           # install dependencies
npm run build         # compile TypeScript → dist/
npm run dev           # watch mode
npm run typecheck     # type-check without emitting
npm run gen-demo      # regenerate pre-rendered HTML in all three demo pages
npm run format        # run Prettier
npm test              # run Vitest + Playwright tests (64 tests)
npx serve .           # serve demo pages at http://localhost:3000
```

After changing `src/render.ts`, `src/config.ts`, or the demo HAR data, run
`npm run build && npm run gen-demo` to keep the pre-rendered demo pages in sync.`

### Demo pages

| Page               | What it demonstrates                                         |
| ------------------ | ------------------------------------------------------------ |
| `static.html`      | Pre-rendered HTML+CSS only — no JS loaded                    |
| `progressive.html` | Pre-rendered + button to lazily load JS and upgrade          |
| `index.html`       | Fully dynamic — URL input and file picker for arbitrary HARs |
````
