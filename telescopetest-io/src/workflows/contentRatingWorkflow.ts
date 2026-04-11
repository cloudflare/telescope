import { WorkflowEntrypoint } from 'cloudflare:workers';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@/generated/prisma/client';

import { rateUrlContent } from '@/lib/ai/aiContentRater';
import { updateContentRating } from '@/lib/repositories/testRepository';
import { ContentRating } from '@/lib/types/tests';

export type RatingParams = {
  testId: string;
  url: string;
};

const VALID_RATINGS = new Set<string>(Object.values(ContentRating));

export class AiContentRatingWorkflow extends WorkflowEntrypoint<
  Env,
  RatingParams
> {
  async run(event: WorkflowEvent<RatingParams>, step: WorkflowStep) {
    const { testId, url } = event.payload;
    // WorkflowEntrypoint has no Astro context.locals, so Prisma is instantiated
    // directly here rather than via the shared getPrismaClient() helper.
    const adapter = new PrismaD1(this.env.TELESCOPE_DB!);
    const prisma = new PrismaClient({ adapter });

    try {
      await step.do('mark-in-progress', async () => {
        await updateContentRating(prisma, testId, ContentRating.IN_PROGRESS);
      });

      // Fetch R2 files and run AI rating in one step to avoid
      // serializing binary data across step boundaries.
      const rawRating = await step.do('run-ai-rating', async () => {
        const [metricsObj, screenshotObj] = await Promise.all([
          this.env.RESULTS_BUCKET!.get(`${testId}/metrics.json`),
          this.env.RESULTS_BUCKET!.get(`${testId}/screenshot.png`),
        ]);
        const metricsBytes = metricsObj
          ? new Uint8Array(await metricsObj.arrayBuffer())
          : undefined;
        const screenshotBytes = screenshotObj
          ? new Uint8Array(await screenshotObj.arrayBuffer())
          : undefined;
        return rateUrlContent(this.env.AI!, url, metricsBytes, screenshotBytes);
      });

      // step.do returns unknown — validate before use so an unexpected value
      // doesn't silently fall through to the else branch and delete files.
      if (typeof rawRating !== 'string' || !VALID_RATINGS.has(rawRating)) {
        throw new Error(`Unexpected rating value from AI: ${rawRating}`);
      }
      const rating = rawRating as ContentRating;

      // Copy SAFE files to public bucket, delete UNSAFE files from private bucket.
      // Paginate R2 list() — returns at most 1000 objects per call.
      await step.do('handle-result', async () => {
        let listed = await this.env.RESULTS_BUCKET!.list({
          prefix: `${testId}/`,
        });
        const objects = [...listed.objects];
        while (listed.truncated) {
          listed = await this.env.RESULTS_BUCKET!.list({
            prefix: `${testId}/`,
            cursor: listed.cursor,
          });
          objects.push(...listed.objects);
        }

        if (rating === ContentRating.SAFE) {
          for (const obj of objects) {
            const file = await this.env.RESULTS_BUCKET!.get(obj.key);
            if (file) {
              await this.env.PUBLIC_RESULTS_BUCKET!.put(obj.key, file.body, {
                httpMetadata: file.httpMetadata,
              });
            }
          }
        } else {
          for (const obj of objects) {
            await this.env.RESULTS_BUCKET!.delete(obj.key);
          }
        }
      });

      // Persist the rating in its own step so file I/O and DB write are
      // independently retryable — if either step fails, only that step retries.
      await step.do('persist-rating', async () => {
        await updateContentRating(prisma, testId, rating);
      });
    } catch (error) {
      // Reset to UNKNOWN if workflow fails so the test doesn't stay stuck as IN_PROGRESS
      try {
        await updateContentRating(prisma, testId, ContentRating.UNKNOWN);
      } catch {
        // Ignore DB reset failure — best-effort cleanup
      }
      throw error;
    }
  }
}
