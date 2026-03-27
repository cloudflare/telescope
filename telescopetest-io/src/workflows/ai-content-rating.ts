import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@/generated/prisma/client';

import { rateUrlContent } from '@/lib/ai/ai-content-rater';
import { updateContentRating } from '@/lib/repositories/testRepository';
import { ContentRating } from '@/lib/types/tests';

export type RatingParams = {
  testId: string;
  url: string;
};

export class AiContentRatingWorkflow extends WorkflowEntrypoint<
  Env,
  RatingParams
> {
  async run(event: WorkflowEvent<RatingParams>, step: WorkflowStep) {
    const { testId, url } = event.payload;
    const adapter = new PrismaD1(this.env.TELESCOPE_DB!);
    const prisma = new PrismaClient({ adapter });

    try {
      await step.do('mark-in-progress', async () => {
        await updateContentRating(prisma, testId, ContentRating.IN_PROGRESS);
      });

      // Fetch R2 files and run AI rating in one step to avoid
      // serializing binary data across step boundaries
      const rating = (await step.do('run-ai-rating', async () => {
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
      })) as ContentRating;

      // Copy SAFE files to public bucket, delete UNSAFE files from private bucket
      await step.do('handle-result', async () => {
        const listed = await this.env.RESULTS_BUCKET!.list({
          prefix: `${testId}/`,
        });
        if (rating === ContentRating.SAFE) {
          for (const obj of listed.objects) {
            const file = await this.env.RESULTS_BUCKET!.get(obj.key);
            if (file) {
              await this.env.PUBLIC_RESULTS_BUCKET!.put(obj.key, file.body, {
                httpMetadata: file.httpMetadata,
              });
            }
          }
        } else {
          for (const obj of listed.objects) {
            await this.env.RESULTS_BUCKET!.delete(obj.key);
          }
        }
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
