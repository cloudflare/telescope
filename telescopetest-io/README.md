# telescopetest.io

This is the website for users to upload and view telescope ZIP results. This is built with Astro web framework and hosted on Cloudflare Workers.

## Directory Structure

```
telescopetest-io/
├── package.json          # Astro + Cloudflare adapter dependencies
├── astro.config.mjs      # Astro config with Cloudflare adapter
├── wrangler.toml         # Workers config: binds worker/index.ts to Astro dist/
├── worker/
│   └── index.ts          # Worker entry: receives requests → delegates to ASSETS (Astro)
├── src/
│   └── pages/
│       └── index.astro   # Homepage
└── public/               # Static assets
```

## Data Flow

1. User request hits Cloudflare edge
2. `worker/index.ts` receives request
3. Worker calls `this.env.ASSETS.fetch(request)`
4. Astro runtime routes to `src/pages/` and renders
5. Response returns to user

## Deployment

This website shold only be deployed on Cloudflare workers on successful PR into @cloudflare/telescope. To run this deployment automatically, we have a GitHub workflow `.github/workflows/deploy.yml`:

1. Checkout code
2. Install Node.js 20
3. `npm ci` in `telescopetest-io/`
4. `npm run build` (generates `dist/`)
5. `npx wrangler deploy` (uploads worker + dist to Cloudflare)

Once successful, the deployed site can be found on telescopetest.io
