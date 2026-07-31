# telescope-web

The web application for uploading and viewing
[`@cloudflare/telescope`](../telescope) test results. It supports two deployment
targets from the same routes and UI:

- Local Node.js: SQLite metadata plus filesystem artifact storage
- Cloudflare Workers: D1 metadata plus R2 artifact storage, with optional
  Workers AI content filtering

Node.js 24+ and npm 11.9+ are required.

## Run locally without Cloudflare

Install dependencies once from the repository root:

```bash
npm install
```

Start the Node.js development server:

```bash
npm run dev -w packages/telescope-web
```

Open the URL printed by Astro, normally <http://localhost:4321>. No Cloudflare
account, Wrangler login, binding setup, or migration command is required. The
SQLite schema and storage directories are created automatically on first use.

Local data defaults to `packages/telescope-web/.telescope-data/`. Override it
with `TELESCOPE_DATA_DIR`:

```bash
TELESCOPE_DATA_DIR=/path/to/telescope-data npm run dev -w packages/telescope-web
```

For a production-style local deployment:

```bash
npm run build -w packages/telescope-web
npm run start -w packages/telescope-web
```

The standalone Node server honors the `HOST` and `PORT` environment variables.

## Cloudflare development and deployment

Cloudflare remains a supported deployment target. Its bindings and environments
are defined in `wrangler.jsonc`.

```bash
# Build using the Cloudflare adapter
npm run build:cloudflare -w packages/telescope-web

# Develop against the Cloudflare runtime and local binding emulators
npm run dev:cloudflare -w packages/telescope-web

# Deploy configured environments
npm run deploy:development -w packages/telescope-web
npm run deploy:staging -w packages/telescope-web
```

Apply D1 migrations before deploying a schema change:

```bash
npm run migrate:development -w packages/telescope-web
npm run migrate:staging -w packages/telescope-web
```

Run `npm run cf-typegen -w packages/telescope-web` after changing bindings in
`wrangler.jsonc`, and commit the updated `worker-configuration.d.ts`.

Workers AI content review is disabled in the development environment and
enabled in staging and production. It is never used by the local Node target.

## Validation

```bash
npm test -w packages/telescope-web
npm run build -w packages/telescope-web
npm run build:cloudflare -w packages/telescope-web
```

Production Cloudflare deployment remains automated by
`.github/workflows/deploy.yml` after changes land on `main`.
