# telescopetest.io

This is the website for users to upload and view Telescope ZIP results. This is built with Astro web framework and hosted on Cloudflare Workers.

## Project Setup

This is how to set up the project from scratch.

- First, run `npm install` and make sure you don't run into any problems. If you do, update Node to the most recent version with `nvm install node` or use a different Node version manager.

## Running Locally

To run this project locally, make sure your Node version is the most recent and change current directory to `telescopetest-io/`. You'll need to then run `npm install` and `npm run preview`.

## Running Locally

To run this project locally, make sure to update your Node version (to at least 18.17.1) and be in this telescopetest-io/ repository. You'll need Then run `npm install` and `npm run preview`.

## Deployment

This website should only be deployed on Cloudflare workers on successful PR into @cloudflare/telescope. To run this deployment automatically, we have a GitHub workflow `.github/workflows/deploy.yml`. This is what that workflow does:

1. Checkouts code
2. Installs Node.js 20
3. `npm ci` in `telescopetest-io/`
4. `npm run build` (generates `dist/`)
5. `npx wrangler deploy` (uploads `dist/` to Cloudflare)

Once successful, the deployed site can be found on [telescopetest.io](telescopetest.io).
