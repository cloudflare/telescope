# telescopetest.io

This is the website for users to upload and view Telescope ZIP results. This is built with Astro web framework and hosted on Cloudflare Workers.

## Project Setup

To set up for local development, you need to install project dependencies:

```
npm install
```

And initialize a few things:

- create local database (will prompt you to confirm that you want to perform the DB migrations)
- generate Prisma client (in `generated/prisma` folder)
- create R2 bucket (might prompt you to log into your Cloudflare account)
- generate TypeScript types to match wrangler configuration (`worker-configuration.d.ts`)

To accomplish all that, you can simply run:

```
npm run dev:setup
```

You should now be able to use the application and run `npm run studio` to view local D1 data in Prisma Studio and create migrations.

## Running Locally

Make sure you've followed all steps in Project Setup above.

Then, you can run `npm run build` and then `npm run dev` to view the site with Astro's hot reload (instantly reflect changes) using the adapter for Cloudflare. Alternatively, you can run `npm run preview` to see Astro with Workers together in one step, but there's no hot reload.

## DB Migrations

We use Prisma to generate SQL for migrations, and Wrangler to apply them. Prisma migrate does not fully support D1 yet, so you cannot follow the default prisma migrate workflows. Instead, migration need to be done as follows:

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

4. Run `npm run generate` to regenerate a Prisma Client that reflects your new changes in `schema.prisma`.
5. Run `npm run migrate:local` to apply this new migration to your local database.

### Note about Workers AI (AI content review)

One thing to note is that telescopetest-io uses Workers AI for AI content review on uploads. Wokers AI _always_ uses tokens that can incur costs, even in local/remote testing. AI content review is disabled locally by default. You can optionally enable AI content review (which may start costing money) by running the command `cp .dev.vars.example .dev.vars` and setting `ENABLE_AI_RATING=true`.

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
