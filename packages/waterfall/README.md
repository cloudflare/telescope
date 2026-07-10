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
import { renderToHTML } from '@cloudflare/waterfall';
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
<script type="module" src="/waterfall/waterfall.js"></script>

<waterfall-chart>
  <!-- pre-rendered children -->
</waterfall-chart>
```

### 3. Fully dynamic (JS-driven)

Supply HAR data via the `src` attribute (fetched) or the `.har` JS property.
The element builds its own DOM from scratch.

```html
<link rel="stylesheet" href="/waterfall/waterfall.css" />
<script type="module" src="/waterfall/waterfall.js"></script>

<!-- fetch from a URL -->
<waterfall-chart src="/api/tests/abc123/pageload.har"></waterfall-chart>
```

```js
// or set a HAR object programmatically
const el = document.querySelector('waterfall-chart');
el.har = harObject;
```

Changing the `src` attribute or reassigning `.har` triggers a full re-render.

### For bundler consumers (Vite, webpack, esbuild, …)

```js
import '@cloudflare/waterfall/waterfall.css';
import { WaterfallChart, renderToHTML } from '@cloudflare/waterfall';
```

Importing the package side-effect-registers the `<waterfall-chart>` custom
element. `renderToHTML(har)` is the same pure function used by drop-in
consumers — it runs in Node.js or the browser with no DOM dependency.

## CLI

The package ships a small CLI that turns a HAR file into a standalone HTML
report. The simplest invocation derives the output filename from the input:

```bash
npx @cloudflare/waterfall pageload.har
# → pageload.html (+ waterfall/waterfall.css, waterfall/waterfall.js)
```

You can also pass the output path explicitly:

```bash
npx @cloudflare/waterfall pageload.har report.html
```

The CLI writes three things alongside the output HTML:

```
report.html
waterfall/waterfall.css   ← linked by the HTML
waterfall/waterfall.js    ← loaded by the HTML (unless --no-js)
```

Open `report.html` directly from disk, or serve the whole folder statically —
the chart is fully self-contained.

> **Heads-up: `file://` + ES modules won't work.** The generated HTML loads
> `waterfall.js` via `<script type="module">`, and browsers treat every
> `file:///…` URL as a distinct opaque origin. Module fetches are blocked by
> CORS in that context, so double-clicking `report.html` will produce a CORS
> error in the console and the chart will not become interactive.
>
> Serve the folder over HTTP instead — for example:
>
> ```bash
> npx serve .
> ```
>
> Then open the URL it prints (e.g. `http://localhost:3000/report.html`).
>
> If you really need a `file://`-openable report, generate it with `--no-js`
> (see below) — the static render does not load any modules and works
> directly from disk.

### Options

| Flag      | Description                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--attr`  | Skip pre-rendering. Copies the HAR next to the output and emits `<waterfall-chart src="<harname>.har">`. The component fetches and renders it at runtime via the bundled JS. Useful for keeping the HAR a separate file. |
| `--no-js` | Omit the `<script>` tag and do not copy `waterfall.js`. The output renders statically from pre-rendered children + `waterfall.css` alone — no interactivity. Cannot be combined with `--attr` (which needs JS to fetch). |
| `--`      | Used in place of the output path: write only the `<waterfall-chart>…</waterfall-chart>` element (no document scaffolding, no asset copying) to stdout. Suitable for redirection or piping into other tools.              |

### Examples

```bash
# Default: pre-rendered, interactive
npx @cloudflare/waterfall pageload.har

# Static-only (no JS, no interactivity, smallest footprint)
npx @cloudflare/waterfall --no-js pageload.har

# Fetch-at-runtime: HAR is a separate file
npx @cloudflare/waterfall --attr pageload.har

# Emit just the <waterfall-chart> snippet to stdout
npx @cloudflare/waterfall pageload.har -- > snippet.html

# Same, with --attr — emits `<waterfall-chart src="pageload.har">`
npx @cloudflare/waterfall --attr pageload.har -- > snippet.html
```

When the output is `--` (stdout), the CLI does **not** copy `waterfall.css`,
`waterfall.js`, or the HAR — it is your responsibility to make those assets
available wherever you embed the snippet.

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
`<html>` (or any ancestor). Demo page's `theme.js` helper does this and persists the
choice to `localStorage`.

```js
document.documentElement.setAttribute('data-theme', 'dark');
```

## Building and testing

### Waterfall component

```bash
npm install           # install dependencies
npm run build         # tsc + Vite library build → dist/
npm run typecheck     # type-check without emitting
npm run format        # run Prettier
npm test              # run Vitest + Playwright tests
```

`npm run build` produces two sets of artifacts in `dist/`:

| File(s)                            | Audience                                                               |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `index.js`, `*.js`, `*.d.ts`       | Bundler consumers (`import { … } from '@cloudflare/waterfall'`)        |
| `waterfall.js`, `waterfall.js.map` | Drop-in consumers (`<script type="module" src="…/waterfall.js">`)      |
| `waterfall.css`                    | Both — link directly or `import '@cloudflare/waterfall/waterfall.css'` |

### Demo pages

The `public/` directory contains a small set of demo pages that exercise each
of the three usage modes against a sample HAR. They are intended for **manual
exploration** of the component (theme toggle, file picker, URL input) — not
for automated tests, which use their own fixtures (see below).

```bash
npm install           # install dependencies
npm run dev           # serve demo pages for local development
                      # (a `predev` hook runs `npm run build` first so
                      # /waterfall/waterfall.js is up to date)
npm run build:demo    # generate demo HTML pages statically
```

| Page                | What it demonstrates                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`                 | Progressive enhancement: pre-rendered chart + button to lazily load JS and upgrade interactivity in place |
| `/interactive.html` | Fully dynamic: empty `<waterfall-chart>` upgraded on load, with a file picker to inject arbitrary HARs    |
| `/src-attr.html`    | Fully dynamic via `src` attribute: URL input and file picker for fetching HARs from a remote location     |

Each demo page also wires up a shared theme toggle (`public/theme.js`) that
persists a `light` / `dark` preference to `localStorage` and sets
`data-theme` on `<html>` to override the OS colour scheme. This toggle is
demo-only chrome — it is not part of the `@cloudflare/waterfall` public API.

After changing `src/render.ts`, `src/config.ts`, or the demo HAR data, run
`npm run build && npm run gen-demo` to keep the pre-rendered HTML in
`/` and `/interactive.html` in sync.

### Test fixtures

Automated tests deliberately do **not** use the demo pages. They live under
`__tests__/fixtures/` and are minimal HTML pages designed to isolate the
chart from any host-page chrome (no navigation, no theme toggle, no
demo-only scripts). Each fixture loads `dist/waterfall.css` (and `dist/waterfall.js`
where needed) via plain `<link>` / `<script>` tags — exactly as a real
downstream consumer would — so the tests exercise the same loading paths
end users do.

| Fixture                          | Used by                                               | Chart state                                                                                                                 |
| -------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `static.html`                    | `theme.test.ts`, `surface-themes.test.ts`             | Pre-rendered chart, **no** `<script>` tag — static / CSS-only render                                                        |
| `progressive-fixture.html`       | `theme.test.ts`, `overlay.test.ts`, `bar-dur.test.ts` | Pre-rendered chart + JS bundle → upgrades in place                                                                          |
| `interactive-fixture.html`       | `overlay.test.ts`, `metric-filters.test.ts`           | Empty `<waterfall-chart>` + JS bundle → tests inject HAR via `.har`                                                         |
| `white-bg.html`, `black-bg.html` | `surface-themes.test.ts`                              | Fixed host body background (white / black) — used to verify chart surface tokens stay themed regardless of host page colour |

The fixtures are served by a shared test helper
(`__tests__/fixture-server.ts`) at paths like `/static`, `/progressive`,
`/interactive`, `/white-bg`, `/black-bg`. Each test file spins up its own
ephemeral server via `createFixtureServer()`.

One test file — `toggle.test.ts` — _does_ use the demo pages, because it
specifically tests the demo's theme-toggle widget (`public/theme.js`). Every
other browser test uses the fixtures.
