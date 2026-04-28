# AGENTS.md — `@cloudflare/waterfall`

Guidance for AI coding agents working in this package.

---

## What this package is

`@cloudflare/waterfall` is a standalone, framework-free **web component** that
renders an HTTP Archive (HAR) waterfall chart.

It lives at `/waterfall/` in the Telescope monorepo.

The custom element `<waterfall-chart>` can be used in three ways:

1. **Static** — pre-rendered HTML children (from `renderToHTML()`) inside
   `<waterfall-chart>` with no JS at all. The element stays undefined and
   `waterfall.css` renders it purely from markup and CSS.
2. **Progressive enhancement** — same pre-rendered children, but the JS bundle
   is loaded lazily. The element upgrades in place, wiring up interactivity
   without re-rendering.
3. **Fully dynamic** — JS loaded upfront. HAR data supplied via the `src`
   attribute (fetched) or the `.har` JS property. The element builds its own
   DOM from scratch.

All three modes use the **same `<waterfall-chart>` tag** and the **same
`waterfall.css`** stylesheet. There is no separate tag or class for the static
case — a `<waterfall-chart>` that has never been upgraded is valid HTML and
renders correctly from its children alone.

---

## Architecture

### The `<waterfall-chart>` tag is used everywhere

All three usage modes — static, progressive, fully dynamic — use the same
`<waterfall-chart>` custom element tag. The browser treats an undefined custom
element as an unknown inline element; `waterfall.css` sets it to
`display: block` and `font-size: 14px` unconditionally, so layout is correct
whether or not the JS bundle has run.

### Static rendering with `renderToHTML()`

`src/render.ts` exports a pure `renderToHTML(har: Har): string` function that
produces the complete inner HTML of a `<waterfall-chart>`. It runs in Node.js
or the browser — no DOM dependency. The output is identical to what the custom
element would build dynamically, so `waterfall.css` renders it correctly with
zero JavaScript.

Each `<li class="wf-row">` in the static output carries `data-*` attributes
(`data-started`, `data-time`, `data-blocked`, `data-dns`, `data-connect`,
`data-ssl`, `data-send`, `data-wait`, `data-receive`, `data-body-size`,
`data-transfer-size`) encoding the timing and size values. These are read back
by the element's `_entryFromRow()` method during progressive upgrade.

### Progressive enhancement — `connectedCallback` upgrade paths

When the JS bundle loads and the element connects, `connectedCallback` checks
which data source is available (highest priority first):

1. **`.har` property set** → `_teardownAndBuild()` + `_loadHarData()` — clears
   all existing children (including any pre-rendered HTML) and does a full
   JS render.
2. **`src` attribute present** → `_teardownAndBuild()` + fetch + `_loadHarData()`.
3. **Pre-rendered children present** (`.wf-list` found in the DOM) →
   `_adoptDOM()` — grabs refs to existing nodes, reconstructs `_allEntries`
   from `data-*` attributes via `_entryFromRow()`, reads page timings from
   event-line `data-label` attributes via `_readPageTimings()`, then wires up
   all interactivity (filter chips, row click → detail panel, column toggle,
   `ResizeObserver` for pixel-accurate event lines) **without touching the DOM**.
4. **Empty element** → nothing; waits for `src`/`.har` to be set.

`_teardownAndBuild()` calls `this.innerHTML = ''` before `_buildDOM()`, so
setting `.har` or `src` on a previously static or progressive element always
produces a clean fresh render.

### Light DOM rendering

The element appends all children directly to `this` (no Shadow Root). This
means:

- `waterfall.css` — linked in `<head>` — styles everything immediately, even
  before the JS module has registered the element.
- The `waterfall-chart:not(:defined):not(:has(.wf-list))` CSS rule shows a
  skeleton placeholder only when the element is undefined **and** has no
  pre-rendered children. Pre-rendered content is never hidden by the skeleton.
- Host-page CSS can freely reach inside the component.

### Event lines and the scrubber

Static rendering positions event lines as **percentages** (`left: X%`) relative
to the overlay width — no layout measurement needed at render time. When the JS
bundle loads and the element upgrades (`_adoptDOM`), a `ResizeObserver` fires
once the ruler has non-zero width and `_renderEventLines()` replaces the
percentage positions with accurate pixel offsets.

The scrubber (`div.wf-scrubber`) is **JS-only** — not part of the static HTML.
`_adoptDOM` creates it and injects it as the last child of `.wf-events-overlay`.
Hovering the list-wrap shows a vertical line at the cursor position labelled with
the time in ms. When the cursor comes within 8 px of an event line the scrubber
hides and the event-line pill switches to its full `data-label` value (name + value).

## CSS

### `waterfall.css` — chart styles

All waterfall visual rules live here. Link it in `<head>` **before** the JS
bundle (or with no JS at all):

```html
<link rel="stylesheet" href="/waterfall/waterfall.css" />
<!-- optional: -->
<script type="module" src="/waterfall/dist/index.js"></script>
```

The skeleton rule only fires when the element is both undefined **and** has no
pre-rendered children:

```css
waterfall-chart:not(:defined):not(:has(.wf-list)) { … }
```

### Token reference

All tokens are CSS custom properties on `:root`:

```css
/* Surface */
--wf-text    --wf-muted    --wf-bg    --wf-panel    --wf-border    --wf-grid
--wf-brand   --wf-success  --wf-warning  --wf-danger

/* Connection phase bars */
--wf-blocked  --wf-dns  --wf-connect  --wf-ssl  --wf-send  --wf-wait

/* Resource type bars (light = send+wait, dark = receive) */
--wf-html-light   --wf-html-dark
--wf-js-light     --wf-js-dark
--wf-css-light    --wf-css-dark
--wf-image-light  --wf-image-dark
--wf-font-light   --wf-font-dark
--wf-video-light  --wf-video-dark
--wf-other-light  --wf-other-dark

/* Row backgrounds */
--wf-row-blocking-bg   --wf-row-blocking-bg-hover   --wf-row-open-bg
```

### Class naming conventions

| Prefix                | Meaning                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `wf-`                 | Waterfall namespace — all classes use this                         |
| `wf-cell--*`          | Cell type: `idx`, `url`, `info`, `stat`, `size`, `dur`, `timeline` |
| `wf-swatch--*`        | Swatch colour modifier (thick = resource type, thin = phase/event) |
| `wb--*`               | Bar colour modifier (e.g. `wb--blocked`, `wb--js-light`)           |
| `wf-event--*`         | Event-line type: `dcl`, `load`, `lcp`                              |
| `row--*`              | Row state: `blocking`, `open`                                      |
| `s2xx/s3xx/s4xx/s5xx` | HTTP status class on `.wf-cell--stat`                              |

### Blocking rows and zebra striping

A row with `row--blocking` gets a red left border on the `.wf-cell--idx` cell,
determined by `isBlocking(entry)` in `helpers.ts`. Even/odd rows use alternating
background colours via `:nth-child` in `waterfall.css` — no border between rows.

The `--wf-border` token is used for high-contrast UI borders (headers, panels);
`--wf-grid` is a separate, subtler token used only for ruler ticks and grid lines.

---

## Public API

### Attributes

| Attribute | Type     | Description                                                                     |
| --------- | -------- | ------------------------------------------------------------------------------- |
| `src`     | `string` | URL to fetch HAR JSON from. Changing it triggers a re-fetch and full re-render. |

### Properties

| Property | Type          | Description                                                                                              |
| -------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| `har`    | `Har \| null` | Set a HAR object directly. Triggers full re-render. Takes priority over `src` and pre-rendered children. |

---

## Common tasks for agents

### Regenerate the demo pages

After changing `src/render.ts` or the demo HAR data in `scripts/gen-demo.js`:

```bash
npm run build && npm run gen-demo
```

This splices fresh pre-rendered HTML into `index.html`, `static.html`, and
`progressive.html` between the marker comments.

### Add a new resource type

1. Add an entry to `TYPE_CONFIG` in `src/config.ts` with `barH` and `key`.
2. Add `--wf-<key>-light` and `--wf-<key>-dark` tokens to `waterfall.css`.
3. Add `.wb--<key>-light` and `.wb--<key>-dark` colour rules to `waterfall.css`.
4. Add the canonical name to `TYPE_ORDER` in `helpers.ts`.
5. Add a swatch entry to the `TYPE_SWATCH` maps in both `waterfall-chart.ts`
   (`_buildDOM` / `_renderFilters`) and `render.ts` (`renderToolbar`) so static
   and dynamic renders stay in sync.

### Change column widths

Edit the `--wf-grid-cols` declarations in the `.wf-list-wrap` and
`.wf-list-wrap.cols-expanded` blocks in `waterfall.css`. The same grid template
is applied to `.wf-col-headers` and `.wf-row` so they stay aligned.

### Add a new detail-panel section

In `waterfall-chart.ts`, find `_togglePanel` and append a new `section()` call
to `body`. The detail panel is JS-only (not part of the static render).

### Change event-line colours

Edit `.wf-event--dcl`, `.wf-event--load`, and `.wf-event--lcp` in
`waterfall.css`. Each has a corresponding `--wf-ev-*` CSS token.

### Theming / dark mode

Add or adjust properties in the `@media (prefers-color-scheme: dark)` block on
`:root` in `waterfall.css`. For demo-page chrome (nav, body, controls), the
dark-mode block is in `demo.css`. Consumers can override tokens on
`waterfall-chart` or any ancestor.

## Package layout

```
waterfall/
├── src/                    Source code
│   ├── waterfall.css       Standalone stylesheet — link in <head>
│   ├── index.ts            JS entrypoint
│   └── ...                 Other source files
├── public/                 Demo pages
├── dist/                   Compiled JS + type declarations (after build)
│   ├── index.html          Demo: pre-rendered + lazy JS upgrade
│   ├── interactive.html    Demo: fully dynamic + file picker
│   └── src-attrs.html      Demo: load HAR from src attribute
├── __tests__/              Test files
└── scripts/
    └── gen-demo.js         Regenerates pre-rendered HTML in demo pages
```
