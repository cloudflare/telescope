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
in place, wiring up interactivity (filters, row click → detail panel, column
toggle) without re-rendering.

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
}
```

Resource-type and phase colours (`--wf-html-light`, `--wf-dns`, etc.) can be
overridden the same way.

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
│   ├── helpers.ts          Pure analysis helpers (parseUrl, computeTotalMs, …)
│   ├── render.ts           renderToHTML(har) — pure server/build-time renderer
│   ├── waterfall-chart.ts  Custom element implementation
│   └── index.ts            Barrel export
├── __tests__/
│   └── theme.test.ts       Playwright-driven visual/theme tests (Vitest)
├── dist/                   Compiled JS + type declarations (after build)
├── scripts/
│   └── gen-demo.js         Regenerates pre-rendered HTML in demo pages
├── waterfall.css           Standalone stylesheet — link in <head>
├── demo.css                Demo page styles
├── static.html             Demo: pure HTML+CSS, no JS
├── progressive.html        Demo: pre-rendered + lazy JS upgrade
├── index.html              Demo: fully dynamic, URL input + file picker
├── theme.js                Sun/Moon theme toggle helper
├── vitest.config.ts        Vitest configuration
├── package.json
└── tsconfig.json
```

## Building and testing

```bash
npm install           # install dependencies
npm run build         # compile TypeScript → dist/
npm run dev           # watch mode
npm run typecheck     # type-check without emitting
npm run gen-demo      # regenerate pre-rendered HTML in all three demo pages
npm test              # run Vitest + Playwright tests
npx serve .           # serve demo pages at http://localhost:3000
```

### Demo pages

| Page               | What it demonstrates                                         |
| ------------------ | ------------------------------------------------------------ |
| `static.html`      | Pre-rendered HTML+CSS only — no JS loaded                    |
| `progressive.html` | Pre-rendered + button to lazily load JS and upgrade          |
| `index.html`       | Fully dynamic — URL input and file picker for arbitrary HARs |
