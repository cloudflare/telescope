# AGENTS.md — `@telescope/waterfall`

Guidance for AI coding agents working in this package.

---

## What this package is

`@telescope/waterfall` is a standalone, framework-free **web component** that
renders an HTTP Archive (HAR) waterfall chart. It lives at `/waterfall/` in
the Telescope monorepo and was extracted from the Astro/SvelteKit site at
`telescopetest-io/src/`.

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

## Directory layout

```
waterfall/
├── src/                        TypeScript source (compiled → dist/)
│   ├── har.ts                  HAR 1.2 type definitions
│   ├── config.ts               Resource-type → bar-height / colour-key map
│   ├── formatters.ts           fmtSize(bytes), fmtMs(ms)
│   ├── helpers.ts              Pure analysis helpers (no side-effects)
│   ├── render.ts               renderToHTML(har) — pure server/build-time renderer
│   ├── waterfall-chart.ts      Custom element class — the main file
│   └── index.ts                Barrel re-export of everything public
├── __tests__/                  Vitest + Playwright test files
│   ���── helpers.ts              Shared test utilities (createServer, openPage, …)
│   ├── theme.test.ts           Theme/color-scheme tests (8 tests)
│   ├── toggle.test.ts          Column-toggle and theme-toggle tests (17 tests)
│   └── overlay.test.ts         Event-line label and scrubber tests (39 tests)
├── dist/                       Compiled JS + .d.ts (git-ignored, generated)
├── scripts/
│   └── gen-demo.js             Generates pre-rendered HTML and splices into demo pages
├── waterfall.css               Standalone stylesheet — include in <head>
├── demo.css                    Shared demo-page styles (nav, body, controls)
├── static.html                 Demo: pure HTML+CSS, no JS
├── progressive.html            Demo: HTML+CSS with lazy JS upgrade button
├── index.html                  Demo: full interactive (JS auto-loaded)
├── theme.js                    Sun/moon theme toggle helper (localStorage + data-theme)
├── package.json                name: @telescope/waterfall, ESM, types
├── vitest.config.ts            Vitest configuration (node environment)
├── tsconfig.json               strict + noUncheckedIndexedAccess
└── README.md                   End-user usage docs
```

waterfall/
├── src/ TypeScript source (compiled → dist/)
│ ├── har.ts HAR 1.2 type definitions
│ ├── config.ts Resource-type → bar-height / colour-key map
│ ├── formatters.ts fmtSize(bytes), fmtMs(ms)
│ ├── helpers.ts Pure analysis helpers (no side-effects)
│ ├── render.ts renderToHTML(har) — pure server/build-time renderer
│ ├── waterfall-chart.ts Custom element class — the main file
│ └── index.ts Barrel re-export of everything public
├── dist/ Compiled JS + .d.ts (git-ignored, generated)
├── scripts/
│ ���── gen-demo.js Generates pre-rendered HTML and splices into demo pages
├── waterfall.css Standalone stylesheet — include in <head>
├── demo.css Shared demo-page styles (nav, body, controls)
├── static.html Demo: pure HTML+CSS, no JS
├── progressive.html Demo: HTML+CSS with lazy JS upgrade button
├── index.html Demo: full interactive (JS auto-loaded)
├── package.json name: @telescope/waterfall, ESM, types
├── tsconfig.json strict + noUncheckedIndexedAccess
└── README.md End-user usage docs

````

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

### DOM structure

```html
<waterfall-chart>
  <!-- Toolbar: resource-type filter chips + phase legend + event legend + col toggle -->
  <div class="wf-toolbar">
    <div class="wf-filters" role="group" aria-label="Filter by resource type">
      <button class="wf-filter-btn active">all</button>
      <button class="wf-filter-btn"><span class="wf-swatch wf-swatch--thick wf-swatch--html"></span>html</button>
      <!-- js, css, image, font, video, other … -->
    </div>
    <div class="wf-legend-group" aria-label="Connection phases">
      <span class="wf-legend-item"><span class="wf-swatch wf-swatch--thin wf-swatch--blocked"></span>Blocked</span>
      <!-- DNS Lookup, TCP Connect, TLS Handshake, Send, Wait (TTFB) … -->
    </div>
    <div class="wf-legend-group" aria-label="Events">
      <span class="wf-legend-item"><span class="wf-swatch wf-swatch--thin wf-swatch--ev-dcl"></span>DOM Content Loaded</span>
      <!-- Page Load, Largest Contentful Paint … -->
    </div>
    <button class="wf-toggle-cols" aria-expanded="false">Show columns</button>
  </div>

  <!-- Main list wrapper (position:relative for the overlays) -->
  <div class="wf-list-wrap [cols-expanded]">

    <!-- Sticky column header row -->
    <div class="wf-col-headers" aria-hidden="true">
      <div class="wf-col-header wf-col-header--idx">#</div>
      <div class="wf-col-header wf-col-header--url">URL</div>
      <!-- info cols: Method / Protocol / Status / Type / Size / Duration -->
      <div class="wf-col-header wf-col-header--timeline">
        <div class="wf-ruler" aria-hidden="true">
          <span class="wf-tick" style="left:X%">0.1s</span> …
        </div>
        <!-- Grid lines behind bars (low z-index) -->
        <div class="wf-grid-overlay" aria-hidden="true">
          <div class="wf-grid-line" style="left:X%"></div> …
        </div>
        <!-- Event lines + scrubber in front of bars (high z-index) -->
        <div class="wf-events-overlay" aria-hidden="true">
          <div class="wf-event-line wf-event--dcl"
               data-label="DCL 340 ms" data-name="DCL"
               style="left:41.92%"></div>
          <div class="wf-event-line wf-event--load" …></div>
          <div class="wf-event-line wf-event--lcp" …></div>
          <!-- scrubber injected by JS only: -->
          <div class="wf-scrubber [wf-scrubber--visible]">
            <span class="wf-scrubber__label">340 ms</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Ordered list of requests — one <li> per HAR entry -->
    <ol class="wf-list" aria-label="Network requests">
      <li class="wf-row wf-row--rh34 [row--blocking] [row--open]"
          data-index="0"
          data-started="2024-01-15T10:00:00.000Z"
          data-time="164"
          data-blocked="12" data-dns="0" data-connect="0" data-ssl="0"
          data-send="6" data-wait="28" data-receive="118"
          data-body-size="18200" data-transfer-size="13104">
        <span class="wf-cell wf-cell--idx">1</span>
        <span class="wf-cell wf-cell--url" title="https://example.com/">
          <span class="wf-url-domain">example.com</span>
          <span class="wf-url-path">/</span>
        </span>
        <!-- info cells (collapsed by default via CSS grid) -->
        <span class="wf-cell wf-cell--info">GET</span>
        <span class="wf-cell wf-cell--info">h2</span>
        <span class="wf-cell wf-cell--info wf-cell--stat s2xx">200</span>
        <span class="wf-cell wf-cell--info">html</span>
        <span class="wf-cell wf-cell--info wf-cell--size">42.1 KB</span>
        <span class="wf-cell wf-cell--info wf-cell--dur">164 ms</span>
        <!-- Timeline bars -->
        <span class="wf-cell wf-cell--timeline" style="--wf-bar-end:26.5%">
          <div class="wf-bar-wrap">
            <div class="wb wb--blocked wb--phase" style="left:0%;width:1.9%"></div>
            <div class="wb wb--html-light" style="left:1.9%;width:5.5%"></div>
            <div class="wb wb--html-dark"  style="left:7.4%;width:19.1%"></div>
          </div>
          <span class="wf-bar-dur">164 ms</span>
        </span>
      </li>
      …
    </ol>

  </div>

  <!-- Detail panel — inserted after .wf-list-wrap on row click (JS only) -->
  <div class="wf-panel" data-panel-index="0"> … </div>

  <!-- State messages -->
  <p class="wf-message wf-loading" aria-live="polite" hidden>Loading waterfall…</p>
  <p class="wf-message wf-message--error wf-error" hidden></p>
</waterfall-chart>
````

### Resource type names

`resourceType()` in `helpers.ts` remaps HAR `_resourceType` values to canonical
short names via `TYPE_REMAP`:

| HAR value    | Canonical name |
| ------------ | -------------- |
| `document`   | `html`         |
| `script`     | `js`           |
| `stylesheet` | `css`          |
| _(others)_   | unchanged      |

Filter chip order is controlled by `TYPE_ORDER` in `helpers.ts`:
`all`, `html`, `js`, `css`, `image`, `font`, `video`, `other`.

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

### Component state fields

| Field                 | Type                       | Purpose                                                                          |
| --------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| `_allEntries`         | `HarEntry[]`               | Full HAR entry list (never filtered)                                             |
| `_activeFilters`      | `Set<string>`              | Active resource-type filters (`'all'` = show all)                                |
| `_activePhaseFilters` | `Set<string>`              | Active connection-phase filters (empty = show all) — **declared, not yet wired** |
| `_hiddenEvents`       | `Set<string>`              | Hidden event keys (`dcl`/`load`/`lcp`) — **declared, not yet wired**             |
| `_openPanels`         | `Map<number, HTMLElement>` | Currently-open detail panels by entry index                                      |
| `_pageTimings`        | `HarPageTimings`           | DCL / Load / LCP ms values                                                       |
| `_totalMs`            | `number`                   | Duration from first request start to last end                                    |
| `_originMs`           | `number`                   | Epoch ms of the first entry's `startedDateTime`                                  |

### Column show/hide

Columns are controlled entirely by CSS grid. `.wf-list-wrap` sets
`--wf-col-info: 0px` by default; adding `.cols-expanded` switches it to `auto`.
No `display:none` — cells stay in the DOM and become visible the moment the
class toggles.

---

## Source files — responsibilities

| File                 | Responsibility                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `har.ts`             | TypeScript interfaces for the HAR 1.2 spec. No logic.                                                                                                                     |
| `config.ts`          | `typeConfig(type)` — maps resource type to `{ barH, key }`.                                                                                                               |
| `formatters.ts`      | `fmtSize(bytes)`, `fmtMs(ms)`.                                                                                                                                            |
| `helpers.ts`         | Pure functions: `parseUrl`, `resourceType` (with `TYPE_REMAP`), `isBlocking`, `computeTotalMs`, `uniqueTypes` (with `TYPE_ORDER`), `pageEvents`, `fmtEventLabel`. No DOM. |
| `render.ts`          | `renderToHTML(har)` — pure string renderer for SSR / build-time use. Mirrors the JS element's DOM output exactly.                                                         |
| `waterfall-chart.ts` | The custom element. Three upgrade paths in `connectedCallback`. Imports everything above.                                                                                 |
| `index.ts`           | Barrel re-export — the public API surface of the package.                                                                                                                 |

---

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

### `demo.css` — demo page styles

Shared across all three demo pages. Contains: page reset, `body`, `h1`,
`.demo-desc`, `.demo-nav`, shared `button`/`input` styles, `.controls`,
`.file-label`, `.enhance-bar`, and dark-mode overrides.

**`demo.css` must only style elements outside `<waterfall-chart>`** — i.e. the
page chrome, navigation, and demo controls. Any rule that targets a `.wf-*`
class or the `waterfall-chart` element itself belongs in `waterfall.css`, not
here. This keeps the chart stylesheet self-contained and usable without the
demo pages.

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

### Exported symbols (`import … from '@telescope/waterfall'`)

- `WaterfallChart` — the custom element class
- `renderToHTML` — pure static renderer
- `typeConfig`, `TypeConfig` — resource-type config
- `fmtSize`, `fmtMs` — formatters
- `parseUrl`, `resourceType`, `isBlocking`, `computeTotalMs`, `uniqueTypes`, `pageEvents`, `fmtEventLabel` — helpers
- All HAR types: `Har`, `HarLog`, `HarPage`, `HarEntry`, `HarRequest`, `HarResponse`, `HarTimings`, `HarContent`, `HarHeader`, `HarCookie`, `HarQueryParam`, `HarPostData`, `HarBrowser`

---

## Build and demo

```bash
cd waterfall
npm install           # install TypeScript + Vitest + Playwright
npm run build         # tsc → dist/
npm run dev           # tsc --watch
npm run typecheck     # type-check only, no emit
npm run gen-demo      # regenerate pre-rendered HTML in all three demo pages
npm test              # run Vitest/Playwright tests (64 tests across 3 files)
npm run format        # run Prettier
npx serve .           # serve at http://localhost:3000
```

Always run `npm run build && npm run gen-demo` after changing `src/render.ts`,
`src/config.ts`, or the demo HAR data, then `npm run format` after editing any
source file, and finally `npm test` before finishing.

### Demo pages

| Page               | What it demonstrates                                                         |
| ------------------ | ---------------------------------------------------------------------------- |
| `static.html`      | `<waterfall-chart>` with pre-rendered children, no JS loaded at all          |
| `progressive.html` | Same pre-rendered children; button lazily injects `dist/index.js` to upgrade |
| `index.html`       | JS auto-loaded; URL input and file picker for loading arbitrary HARs         |

All three pages share `waterfall.css` and `demo.css`, and contain identical
pre-rendered waterfall HTML (generated by `scripts/gen-demo.js` between
`<!-- wf-demo-start -->` / `<!-- wf-demo-end -->` markers). Run
`npm run gen-demo` after any change to `src/render.ts` or the demo HAR data.

---

## Relationship to `telescopetest-io/`

| `telescopetest-io/`               | `waterfall/`                                                 |
| --------------------------------- | ------------------------------------------------------------ |
| `src/lib/waterfall/config.ts`     | `src/config.ts` (identical logic)                            |
| `src/lib/waterfall/formatters.ts` | `src/formatters.ts` (identical logic)                        |
| `src/lib/waterfall/helpers.ts`    | `src/helpers.ts` (import path updated)                       |
| `src/lib/waterfall/dom.ts`        | Inlined as local `el()` helper in `waterfall-chart.ts`       |
| `src/lib/types/har.ts`            | `src/har.ts` (identical)                                     |
| `src/components/Waterfall.astro`  | `src/waterfall-chart.ts` + `waterfall.css` + `src/render.ts` |

The original Astro component used a `<table>/<tbody>/<tr>` layout and kept all
CSS in `<style is:global>` blocks. This package uses an `<ol>`/`<li>` grid
layout, a separate linked stylesheet, no Shadow DOM, and a pure static renderer.

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

### Implement phase/event filter buttons (not yet done)

The toolbar already has `.wf-legend-group` containers for connection phases and
events, but their children are plain `<span class="wf-legend-item">` elements.
To make them interactive:

1. Change phase spans to `<button class="wf-filter-btn" data-phase="blocked">…`
   etc. in both `_buildDOM()` (`waterfall-chart.ts`) and `renderToolbar()`
   (`render.ts`). Keys: `blocked`, `dns`, `connect`, `ssl`, `send`, `wait`.
2. Change event spans to `<button class="wf-filter-btn" data-event="dcl">…`
   etc. Keys: `dcl`, `load`, `lcp`.
3. In `_adoptDOM()`, wire phase buttons by `data-phase`: clicking toggles the key
   in `_activePhaseFilters` and calls `_renderRows()`.
4. In `_adoptDOM()`, wire event buttons by `data-event`: clicking toggles the key
   in `_hiddenEvents` and adds/removes a hidden class on the corresponding
   `.wf-event--<key>` element in `_overlayEl`.
5. Extend `_renderRows()`: a row passes the phase filter if `_activePhaseFilters`
   is empty **or** the entry has a non-zero value for any active phase.
   Phase → timing field mapping:
   - `blocked` → `t.blocked + t._blocked_queueing`
   - `dns` → `t.dns`
   - `connect` → `t.connect`
   - `ssl` → `t.ssl`
   - `send` → `t.send`
   - `wait` → `t.wait`
6. Reset `_activePhaseFilters` and `_hiddenEvents` in `_teardownAndBuild()` and `_reset()`.
