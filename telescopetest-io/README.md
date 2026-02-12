# telescopetest.io

This is the website for users to upload and view Telescope ZIP results. This is built with Astro web framework and hosted on Cloudflare Workers.

## Project Setup

This is how to set up the project. These steps are neccessary for local testing.

1. First, make sure your Node version is set to version 'lts/jod' and your current directory is `telescopetest-io/`.
2. Run `npm install` and make sure you don't run into any problems. If you do, update Node to version 'lts/jod' nvm or a different Node version manager.
3. Next, to create a local D1 dev database, run `npx wrangler d1 execute telescope-db-development --local --env development --command "SELECT 1;"`. This will create a local D1 dev database called `telescope-db-development`.
4. Next, to create a local R2 Bucket, run `npx wrangler r2 bucket create results-bucket-development`. This step may prompt you to log in with wrangler.

For type safety, Worker and binding types are defined in `worker-configuration.d.ts`. Any changes to the `wrangler.jsonc` require regenerating this file, which you can do by running the command `npm run cf-typegen`.

#### Initial Prisma Setup

Once you've finished the steps above, run these to set up Prisma, the ORM we're with D1. This is a [preview feature](https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1#migration-workflows) that Prisma has been building out since 2024.

1. Make sure you have the local `telescope-db-development` table.
2. Copy the relative path (without telescopetest-io/) of this local `.sqlite` file in the folder `.wrangler/state/v3/d1/miniflare... ` and put this into a new `.env` file at the root of the `telescopetest-io` project as `DATABASE_URL="file:{{relative_path}}`.
3. Run `npm run generate` to generate a Prisma Client.

## Migrations

Prisma migrate does not support D1 yet, so you cannot follow the default prisma migrate workflows. Instead, migration files need to be created as follows.

#### Normal Use

1. Make your edits to `prisma/schema.prisma`.
2. Run `npx wrangler d1 migrations create telescope-db-development {{describe_changes_here}} --env development`. This should create an empty SQLite file with a comment at the top.
3. Run

```
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema ./prisma/schema.prisma \
  --script \
  --output migrations/{{file_created_by_previous_step}}.sql
```

This should fill your created file with the raw SQLite for your changes.

4. Run `npx wrangler d1 migrations apply telescope-db-development --local --env development`
5. Regenerate a Prisma Client that reflects your new changes in `schema.prisma` with `npm run generate`.

## Running Locally

Make sure you've followed all steps in Project Setup and Migrations -> Initial Local Setup.

Then, you can run `npm run build` and then `npm run dev` to view the site with Astro's hot reload (instantly reflect changes) using the adapter for Cloudflare. Alternatively, you can run `npm run preview` to see Astro with Workers together in one step, but there's no hot reload.

## Testing in Staging

Staging allows you to test changes in a remote environment that isn't production. To deploy to staging, run `npm run deploy:staging`. This command will only work if you have permission to deploy to telesceoptest-io's remote Worker.

## Deployment to Production

Changes to the production website should only be deployed on Cloudflare workers on successful PR into @cloudflare/telescope. To run this deployment, we have a GitHub workflow `.github/workflows/deploy.yml`. This is what that workflow does:

1. Checks out code
2. Installs Node.js 20
3. Installs project dependencies
4. Applies any new D1 migrations
5. Generates Prisma client
6. Builds project (generates `dist/`)
7. Deploys project (uploads `dist/` to Cloudflare)

Once successful, the deployed site can be found on [telescopetest.io](telescopetest.io).
