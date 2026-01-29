# telescopetest.io

This is the website for users to upload and view telescope ZIP results. This is built with Astro web framework and hosted on Cloudflare Workers.

## Directory Structure

```
telescopetest-io/
├── package.json          # Astro + Cloudflare adapter dependencies
├── astro.config.mjs      # Astro config with Cloudflare adapter
├── wrangler.jsonc        # Workers config: binds worker/index.ts to Astro dist/
├── src/
│   └── pages/
│       └── index.astro   # Homepage
└── public/               # Static assets
```

## Deployment

This website shold only be deployed on Cloudflare workers on successful PR into @cloudflare/telescope. To run this deployment automatically, we have a GitHub workflow `.github/workflows/deploy.yml`:

1. Checkout code
2. Install Node.js 20
3. `npm ci` in `telescopetest-io/`
4. `npm run build` (generates `dist/`)
5. `npx wrangler deploy` (uploads worker + dist to Cloudflare)

Once successful, the deployed site can be found on telescopetest.io.
