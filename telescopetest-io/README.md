# telescopetest.io

This is the website for users to upload and view Telescope ZIP results. This is built with Astro web framework and hosted on Cloudflare Workers.

## Project Setup

These are the logs for how this project was created and deployed on Cloudflare workers. These can also be used as instructions for how to set up this project from scratch.

- I used Astro 5.x, which needs Node version [18.17.1 or higher](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/#nodejs-requirements). I used Node version 25.3.0, I think you can just using whatever is the highest version.
- I started\* this as a default Astro Workers project ([documentation](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/#deploy-a-new-astro-project-on-workers)) with the command `npm create cloudflare@latest -- telescopetest-io --framework=astro`.
  - \*I actually first tried manually building out the Astro project framework myself, but this was too messy and I scrapped it.
- I then added the [custom domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/#set-up-a-custom-domain-in-your-wrangler-configuration-file) 'telescopetest.io' to the wrangler.jsonc. file.
  - IMPORTANT: make sure no domain rules in Cloudflare conflict with rendering the page or CSS.
- To create a D1 SQLite database, I ran `npx wrangler@latest d1 create telescope-db` following [documentation](https://developers.cloudflare.com/d1/get-started/). This creates a remote (production) D1 database.
  - If you are trying to follow these steps, running this command might cause an error because "telescope-db" already exists remotely. In that case, to run wrangler commands just locally, just replace the "database_id" in wrangler.jsonc with any string, like "local", or "testing", or "can-be-anything-just-need-id".
- I then connected it to a db/schema.sql I manually created with `npx wrangler d1 execute telescope-db --local --file=./db/schema.sql`. I got some FileHandle Error 22, which I had to fix by updating my local wrangler version to the most recent (4.61.0). This created a local database, with the schema I defined. To add this table to production, I had to run this command again with the `--remote` flag in place of `--local`.
- To create a R2 Bucket, I ran `npx wrangler r2 bucket create results-bucket` following [documentation](https://developers.cloudflare.com/r2/get-started/workers-api/). I had to log in. This creates a remote R2 bucket.

## Directory Structure

```
telescopetest-io/
├── package.json                    # Dependencies, scripts
├── astro.config.mjs                # Astro config with Cloudflare adapter & platformProxy
├── wrangler.jsonc                  # Cloudflare Workers config: D1, R2, custom domain
├── worker-configuration.d.ts       # TypeScript types for Cloudflare env bindings
├── tsconfig.json                   # TypeScript configuration
│
├── db/
│   └── schema.sql                  # D1 database schema definition
│
├── src/
│   ├── env.d.ts                    # Astro environment types
│   │
│   ├── pages/
│   │   ├── index.astro             # Homepage
│   │   ├── upload.astro            # Test upload page
│   │   └── api/
│   │       └── upload.ts           # POST endpoint: handles ZIP upload, validation, D1/R2 storage
│   │
│   ├── layouts/
│   │   └── Layout.astro            # Base page layout
│   │
│   ├── components/
│   │   └── TopNav.astro            # Navigation component
│   │
│   └── lib/
│       ├── classes/
│       │   └── TestConfig.ts       # TestConfig class & TestSource enum
│       └── d1/
│           ├── d1-client.ts        # D1 database client wrapper
│           └── test-store/
│               └── d1-test-store.ts # Test CRUD operations (D1 queries)
│
├── public/                         # Static assets
│
└── dist/                           # Build output
```

## Running Locally

To run this project locally, make sure to update your Node version (to at least 18.17.1) and be in this telescopetest-io/ repository. You'll need Then run `npm install` and `npm run preview`.

## Deployment

This website should only be deployed on Cloudflare workers on successful PR into @cloudflare/telescope. To run this deployment automatically, we have a GitHub workflow `.github/workflows/deploy.yml`:

1. Checkout code
2. Install Node.js 20
3. `npm ci` in `telescopetest-io/`
4. `npm run build` (generates `dist/`)
5. `npx wrangler deploy` (uploads worker + dist/ to Cloudflare)

Once successful, the deployed site can be found on [telescopetest.io](telescopetest.io).
