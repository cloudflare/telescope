import { handle } from '@astrojs/cloudflare/handler';

export { AiContentRatingWorkflow } from './workflows/ai-content-rating';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return handle(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
