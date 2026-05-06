# Telescope Web — Agent Guide

## Package Overview

`telescope-web` is an Astro web application that serves as the Telescope results UI. It runs in **two modes**, selected at build/run time via the `TELESCOPE_MODE` environment variable:

- `cloudflare` (default) — Astro + Cloudflare Workers, backed by D1 (Prisma), R2, and Workers AI
- `local` — Astro + Node.js standalone, backed by the local filesystem (no DB, no AI)

It is a fully independent project from the core `packages/telescope/` library — do not mix concerns between the two packages.

Key subdirectories:

- `src/` — Astro pages, React components, API routes, and runtime abstractions
  - `src/lib/storage/` — `IStorage` interface + `LocalStorage` / `CloudflareStorage` implementations + factory
  - `src/lib/repositories/` — `ITestStore` interface + `LocalTestStore` / `D1TestStore` implementations
  - `src/lib/config/mode.ts` — `getMode()`, `getResultsDir()` runtime helpers
- `scripts/` — Dev setup helpers
- `migrations/` — D1 database migration files (cloudflare mode only)

---

## Modes

### Local mode (`TELESCOPE_MODE=local`)

- Uses `@astrojs/node` adapter (standalone)
- Reads test results directly from `RESULTS_DIR` (default `./results`)
- Each subdirectory is a test; metadata comes from the `config.json` inside (including `name` and `description` when written by the CLI)
- Upload extracts the ZIP into `RESULTS_DIR/{testId}/` and merges form-supplied `name`/`description` into `config.json`
- Dedup is by folder name — re-uploading produces 409
- AI content rating is disabled; all tests are reported safe
- No Prisma, no Wrangler

### Cloudflare mode (`TELESCOPE_MODE=cloudflare`, default)

- Uses `@astrojs/cloudflare` adapter
- Test metadata in D1 via Prisma; binary results in R2 (`RESULTS_BUCKET`)
- Upload writes to D1 + R2; dedup is by SHA-256 hash of the ZIP contents
- AI content rating runs via Workers AI when `ENABLE_AI_RATING=true`

The page/component/API code is mode-agnostic and reaches storage and metadata through `Astro.locals.storage` and `Astro.locals.testStore`, which middleware resolves on each request.

---

## Build, Lint, and Test Commands

Commands below are run from `packages/telescope-web/`. To run from the repo root, use `npm run <script> -w packages/telescope-web`.

### Dev — local mode

```bash
npm run dev:local           # astro dev with @astrojs/node + filesystem
npm run build:local         # astro build for the standalone Node server
npm run start:local         # node ./dist/server/entry.mjs
```

Override the results location with `RESULTS_DIR=/path/to/results npm run dev:local`.

### Dev — cloudflare mode

```bash
npm run dev                 # astro dev (cloudflare adapter, requires Wrangler login)
npm run dev:setup           # ./scripts/dev-setup.sh (first-time setup)
npm run dev:clean           # rm -rf .wrangler .env dist node_modules
```

### Build

```bash
npm run build:development   # cloudflare development env
npm run build:staging       # cloudflare staging env
npm run build:local         # local Node standalone
npm run preview             # astro preview
```

### Deploy (cloudflare only)

```bash
npm run deploy:development
npm run deploy:staging
```

### Database (cloudflare only)

```bash
npm run migrate:development
npm run migrate:staging
npm run generate            # prisma generate
npm run studio              # prisma studio
```

### Types

```bash
npm run cf-typegen          # wrangler types → worker-configuration.d.ts
```

### Test

```bash
npm test                    # vitest run
```

---

## Architecture Notes

- This package is **fully excluded** from `packages/telescope/` tooling configs and from root-level build/lint/test workspace scripts.
- `node_modules` is hoisted to the repo root via npm workspaces — do not run `npm install` from within this directory expecting a local `node_modules`.
- Mode is selected at build time by `astro.config.mjs` reading `process.env.TELESCOPE_MODE`. The selected adapter is the only adapter loaded; the other implementation is reachable only via dynamic `import()` inside the storage/testStore factory.
- In local mode, `astro.config.mjs` externalises `cloudflare:workers`, `@prisma/adapter-d1`, `@/generated/prisma/client`, `cloudflareStorage`, and `d1TestStore` so Rollup never tries to resolve them.
- `App.Locals` (`src/env.d.ts`) is dual-mode: `prisma` is `null` in local mode, Cloudflare runtime fields are `Partial<>`.
- The CLI in `packages/telescope` writes `--name` and `--description` directly into `config.json`, so `LocalTestStore.getAll()` can surface those fields without a sidecar file.

---

## Adding a new storage-backed feature

1. Add the read/write to `IStorage` in `src/lib/storage/storage.ts` if not already covered by `get`/`getJSON`/`put`/`list`/`exists`.
2. Implement it in **both** `LocalStorage` (`node:fs`) and `CloudflareStorage` (`env.RESULTS_BUCKET`).
3. Use `Astro.locals.storage` from pages, components, and API routes — never import the implementations or `cloudflare:workers` directly outside the `lib/storage` and `lib/repositories` directories.
4. If the feature touches metadata, extend `ITestStore` and both implementations symmetrically.
