import { env, WorkflowEntrypoint } from 'cloudflare:workers';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@/generated/prisma/client';

import { rateUrlContent } from '@/lib/ai/aiContentRater';
import {
  markInProgressIfUnknown,
  resetInProgressToUnknown,
  updateContentRating,
} from '@/lib/repositories/testRepository';
import { ContentRating } from '@/lib/types/tests';
import { isExpectedTelescopeFile } from '@/lib/utils/security';

export type RatingParams = {
  testId: string;
  url: string;
};

export const READY_SENTINEL = '.ready';

export class AiContentRatingWorkflow extends WorkflowEntrypoint<
  Env,
  RatingParams
> {
  async run(event: WorkflowEvent<RatingParams>, step: WorkflowStep) {
    const { testId, url } = event.payload;
    // WorkflowEntrypoint has no Astro context.locals, so Prisma is instantiated
    // directly here rather than via the shared getPrismaClient() helper.
    const adapter = new PrismaD1(env.TELESCOPE_DB!);
    const prisma = new PrismaClient({ adapter });

    try {
      const proceeded = await step.do('mark-in-progress', async () => {
        return markInProgressIfUnknown(prisma, testId);
      });
      if (!proceeded) {
        // Already finalized; nothing to do. Skip AI work and R2 mutation.
        return;
      }

      // Fetch R2 files and run AI rating in one step to avoid
      // serializing binary data across step boundaries.
      const rawRating = await step.do('run-ai-rating', async () => {
        const [metricsObj, screenshotObj] = await Promise.all([
          env.RESULTS_BUCKET!.get(`${testId}/metrics.json`),
          env.RESULTS_BUCKET!.get(`${testId}/screenshot.png`),
        ]);
        const metricsBytes = metricsObj
          ? new Uint8Array(await metricsObj.arrayBuffer())
          : undefined;
        const screenshotBytes = screenshotObj
          ? new Uint8Array(await screenshotObj.arrayBuffer())
          : undefined;
        return rateUrlContent(env.AI!, url, metricsBytes, screenshotBytes);
      });

      if (
        rawRating !== ContentRating.SAFE &&
        rawRating !== ContentRating.UNSAFE
      ) {
        throw new Error(`Unexpected terminal rating from AI: ${rawRating}`);
      }
      const rating: ContentRating.SAFE | ContentRating.UNSAFE = rawRating;

      // Copy SAFE files to public bucket, delete UNSAFE files from private bucket.
      // Paginate R2 list() — returns at most 1000 objects per call.
      await step.do('handle-result', async () => {
        let listed = await env.RESULTS_BUCKET!.list({
          prefix: `${testId}/`,
        });
        const objects = [...listed.objects];
        while (listed.truncated) {
          listed = await env.RESULTS_BUCKET!.list({
            prefix: `${testId}/`,
            cursor: listed.cursor,
          });
          objects.push(...listed.objects);
        }

        if (rating === ContentRating.SAFE) {
          for (const obj of objects) {
            const relativePath = obj.key.slice(`${testId}/`.length);
            if (!isExpectedTelescopeFile(relativePath)) {
              console.warn(
                `[Workflow] Skipping unexpected file in public copy: ${obj.key}`,
              );
              continue;
            }
            const file = await env.RESULTS_BUCKET!.get(obj.key);
            if (file) {
              await env.PUBLIC_RESULTS_BUCKET!.put(obj.key, file.body, {
                httpMetadata: file.httpMetadata,
              });
            }
          }
        } else {
          for (const obj of objects) {
            await env.RESULTS_BUCKET!.delete(obj.key);
          }
        }
      });

      if (rating === ContentRating.SAFE) {
        await step.do('mark-ready', async () => {
          await env.PUBLIC_RESULTS_BUCKET!.put(
            `${testId}/${READY_SENTINEL}`,
            new Uint8Array(0),
          );
        });
      }

      // Persist the rating in its own step so file I/O and DB write are
      // independently retryable — if either step fails, only that step retries.
      await step.do('persist-rating', async () => {
        await updateContentRating(prisma, testId, rating);
      });
    } catch (error) {
      try {
        await resetInProgressToUnknown(prisma, testId);
      } catch {
        // Ignore DB reset failure — best-effort cleanup
      }
      throw error;
    }
  }
}
