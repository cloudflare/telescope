// handle is an internal export of @astrojs/cloudflare — not a public stable API.
// If it breaks on an adapter upgrade, check the adapter's entrypoints/ directory.
// Should maybe pin @astrojs/cloudflare tightly in package.json (currently ^13.1.3).
import { handle } from '@astrojs/cloudflare/handler';

export { AiContentRatingWorkflow } from './workflows/contentRatingWorkflow';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return handle(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
