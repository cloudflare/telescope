# telescopetest.io

This is the website for users to upload and view Telescope ZIP results. This is built with Astro web framework and hosted on Cloudflare Workers.

## Project Setup

This is how to set up the project from scratch.

- First, run `npm install` and make sure you don't run into any problems. If you do, update Node to the most recent version with `nvm install node` or use a different Node version manager.

## Running Locally

To run this project locally, make sure your Node version is the most recent and change current directory to `telescopetest-io/`. You'll need to then run `npm install` and `npm run preview`.

## Testing in Staging

Staging allows you to test changes in a remote environment that isn't production. To deploy to staging, run `npm run deploy:staging`. This command will only work if you have permission to deploy to telesceoptest-io's Worker.

## Deployment to Production

Changes to the production website should only be deployed on Cloudflare workers on successful PR into @cloudflare/telescope. To run this deployment, we have a GitHub workflow `.github/workflows/deploy.yml`. This is what that workflow does:

1. Checks out code
2. Installs Node.js 20
3. `npm ci` in `telescopetest-io/`
4. `npm run build` (generates `dist/`)
5. `npx wrangler deploy` (uploads `dist/` to Cloudflare)

Once successful, the deployed site can be found on [telescopetest.io](telescopetest.io).
