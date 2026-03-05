# `<waterfall-chart>` web component

A self-contained, framework-free web component that renders an HTTP Archive
(HAR) waterfall chart. All styling lives in the Shadow DOM — no external CSS
needed and no leakage into the host page.

This is a conversion of the waterfall implementation in
`telescopetest-io/src/lib/waterfall/` + `telescopetest-io/src/components/Waterfall.astro`
into a reusable custom element.

## Usage

### Via `src` attribute (URL fetch)

```html
<script type="module" src="/waterfall/dist/index.js"></script>

<waterfall-chart src="/api/tests/abc123/pageload.har"></waterfall-chart>
```

Changing the `src` attribute causes the component to re-fetch and re-render.

### Via `har` property (programmatic)

```js
import { WaterfallChart } from '@telescope/waterfall';

const el = document.querySelector('waterfall-chart');
el.har = harObject; // a plain HAR-spec JS object
```

### Demo

Build the package then open `demo.html` with any static file server:

```bash
npm run build
npx serve .
# open http://localhost:3000/demo.html
```

## Theming

All colours are CSS custom properties declared on `:host` and can be overridden
from outside the Shadow DOM:

```css
waterfall-chart {
  --wf-brand: #7c3aed; /* filter chip / toggle button active colour */
  --wf-text: #f9fafb; /* primary text */
  --wf-muted: #9ca3af;
  --wf-bg: #111827; /* page background */
  --wf-panel: #1f2937; /* card / thead background */
  --wf-border: #374151;
}
```

Resource-type and phase colours (`--wf-html-light`, `--wf-dns`, etc.) can be
overridden the same way.

## Package layout

```
waterfall/
├── src/
│   ├── har.ts              HAR 1.2 TypeScript types
│   ├── config.ts           Resource-type → bar-height / colour-key map
│   ├── formatters.ts       fmtSize / fmtMs helpers
│   ├── helpers.ts          Pure analysis helpers (parseUrl, computeTotalMs, …)
│   ├── waterfall-chart.ts  Custom element implementation
│   └── index.ts            Barrel export
├── dist/                   Compiled JS + type declarations (after build)
├── demo.html               Interactive demo page
├── package.json
└── tsconfig.json
```

## Building

```bash
npm install
npm run build      # emits to dist/
npm run dev        # watch mode
npm run typecheck  # type-check without emitting
```
