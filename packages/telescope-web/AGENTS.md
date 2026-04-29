# Telescope Web — Agent Guide

## Package Overview

`telescope-web` is an Astro + Cloudflare Workers web application that serves as the Telescope results UI. It is a fully independent project from the core `packages/telescope/` library — do not mix concerns between the two packages.

Key subdirectories:

- `src/` — Astro pages, React components, and Workers API routes
- `scripts/` — Dev setup helpers
- `migrations/` — D1 database migration files

---

## Build, Lint, and Test Commands

Commands below are run from `packages/telescope-web/`. To run from the repo root, use `npm run <script> -w packages/telescope-web`.

### Dev

```bash
npm run dev             # start local dev server (Cloudflare development env)
npm run dev:setup       # run ./scripts/dev-setup.sh (first-time setup)
npm run dev:clean       # rm -rf .wrangler .env dist node_modules
```

### Build

```bash
npm run build:development   # astro build for development env
npm run build:staging       # astro build for staging env
npm run preview             # astro preview
```

### Deploy

```bash
npm run deploy:development  # build:development + wrangler deploy --env development
npm run deploy:staging      # build:staging + wrangler deploy --env staging
```

### Database (D1 + Prisma)

```bash
npm run migrate:development  # apply D1 migrations locally (development)
npm run migrate:staging      # apply D1 migrations remotely (staging)
npm run generate             # prisma generate
npm run studio               # prisma studio
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
- Environment-specific config is controlled via `CLOUDFLARE_ENV` (set by `cross-env` in npm scripts) and Wrangler environments.
- D1 database bindings are configured in `wrangler.jsonc` per environment.
