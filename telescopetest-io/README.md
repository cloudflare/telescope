# telescopetest.io

This is the website for users to upload and view Telescope ZIP results. This is built with Astro web framework and hosted on Cloudflare Workers.

## Project Setup

This is how to set up the project. These steps are neccessary for local testing.

- First, make sure your Node version is the most recent and your current directory is `telescopetest-io/`.
- Run `npm install` and make sure you don't run into any problems. If you do, update Node to the most recent version with `nvm install node` or a different Node version manager.
- Next, to create a local D1 dev database, run `npx wrangler d1 execute telescope-db-development --local --env development --file=./db/schema.sql`. This will create a local D1 dev database called `telescope-db-development` with the `tests` table as described in `./db/schema.sql`.
- Next, to create a local R2 Bucket, run `npx wrangler r2 bucket create results-bucket-development`. This step may prompt you to log in with wrangler.

For type safety, Worker and binding types are defined in `worker-configuration.d.ts`. Any changes to the `wrangler.jsonc` require regenerating this file, which you can do by running the command `npm run cf-typegen`.

## Running Locally

Make sure you've followed all steps in Project Setup. Then, you can run `npm run build` and then `npm run dev` to view the site with Astro's hot reload (instantly reflect changes) using the adapter for Cloudflare. Alternatively, you can run `npm run preview` to see Astro with Workers together in one step, but there's no hot reload.

## Migrations

- To make migrations and database management simpler, we're using Prisma ORM with D1. This is a [preview feature](https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1#migration-workflows) that Prisma has been building out since 2024, so some features are still being built out.
- Prisma migrate does not support D1 yet, so you cannot follow the default prisma migrate workflows. Instead, migration files need to be created like this:
  1.  Make schema changes in `telescopetest-io/prisma/schema.prisma`
  2.  Run this command to create a migration file:

      ```bash
      npx prisma migrate diff \
      --from-local-d1 \
      --to-schema prisma/schema.prisma \
      --script > prisma/migrations/<#_your_change_name>.sql

      ```

  3.  Regenerate a prisma client that reflects your new changes in `schema.prisma` and apply the newly created migration file locally (in development environment) with the command `npm run migrate:local`.

- To read more about prisma D1 migrations, read [here](https://www.prisma.io/docs/guides/cloudflare-d1#52-generate-migration-sql).

## Testing in Staging

Staging allows you to test changes in a remote environment that isn't production. To deploy to staging, run `npm run deploy:staging`. This command will only work if you have permission to deploy to telesceoptest-io's remote Worker.

## Deployment to Production

Changes to the production website should only be deployed on Cloudflare workers on successful PR into @cloudflare/telescope. To run this deployment, we have a GitHub workflow `.github/workflows/deploy.yml`. This is what that workflow does:

1. Checks out code
2. Installs Node.js 20
3. `npm ci` in `telescopetest-io/`
4. `npm run build` (generates `dist/`)
5. `npx wrangler deploy --env production` (uploads `dist/` to Cloudflare)

Once successful, the deployed site can be found on [telescopetest.io](telescopetest.io).
