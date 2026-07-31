# Telescope Web — Agent Guide

## Package Overview

`telescope-web` is an Astro application with local Node.js and Cloudflare Workers deployment targets. It is fully independent from the core `packages/telescope/` library — do not mix concerns between the two packages.

Key subdirectories:

- `src/` — Astro pages, React components, API routes, and runtime storage adapters
- `migrations/` — D1 database migrations for Cloudflare deployments
- `.telescope-data/` — automatically created local SQLite database and artifacts (gitignored)

---

## Build, Lint, and Test Commands

Commands below are run from `packages/telescope-web/`. To run from the repo root, use `npm run <script> -w packages/telescope-web`.

### Dev

```bash
npm run dev                 # local Node.js development (no Cloudflare required)
npm run dev:cloudflare      # Cloudflare adapter and local binding emulation
```

### Build

```bash
npm run build               # standalone Node.js build
npm run build:cloudflare    # Cloudflare Workers build
npm run build:staging       # Cloudflare staging build
npm run start               # run the standalone Node.js build
```

### Deploy

```bash
npm run deploy:development  # build:cloudflare + wrangler deploy --env development
npm run deploy:staging      # build:staging + wrangler deploy --env staging
```

### Cloudflare database

```bash
npm run migrate:development  # apply D1 migrations locally (development)
npm run migrate:staging      # apply D1 migrations remotely (staging)
```

### Types

```bash
npm run cf-typegen           # wrangler types
```

### Test

```bash
npm test                     # vitest run
```

---

## Architecture Notes

- This package is **fully excluded** from `packages/telescope/` tooling configs and from root-level build/lint/test workspace scripts.
- `node_modules` is hoisted to the repo root via npm workspaces — do not run `npm install` from within this directory expecting a local `node_modules`.
- `DEPLOY_TARGET` selects the Astro adapter; Node is the default and Cloudflare builds set it to `cloudflare`.
- Local storage uses SQLite and the filesystem under `.telescope-data/`, configurable with `TELESCOPE_DATA_DIR`.
- Cloudflare storage uses D1 and R2 bindings from `wrangler.jsonc`; Workers AI remains optional and Cloudflare-only.
- Routes must use `context.locals.services`, never import Cloudflare bindings directly, so both targets stay portable.
