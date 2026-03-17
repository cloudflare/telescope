/**
 * Shared data loader for test result pages.
 *
 * Every tab page (summary, metrics, waterfall, resources, console) needs
 * the core test record, AI-rating flags, screenshot URL, HAR browser info,
 * and a formatted date string. This module fetches all of that once and
 * returns it in a single object so each page doesn't duplicate the logic.
 */
import type { AstroGlobal } from 'astro';
import { getPrismaClient } from '@/lib/prisma/client';
import { getTestById } from '@/lib/repositories/testRepository';
import { ContentRating } from '@/lib/types/tests';
import { getR2Json, r2Exists } from '@/lib/cache/r2Cache';

export interface TestResultBase {
  testId: string;
  test: NonNullable<Awaited<ReturnType<typeof getTestById>>>;
  isUnknown: boolean;
  isUnsafe: boolean;
  screenshotUrl: string | null;
  harBrowser: { name: string; version: string } | null;
  hasHar: boolean;
  formattedDate: string;
}

/**
 * Load the common test-result data needed by every tab.
 *
 * Returns `null` when testId is missing or the test doesn't exist —
 * callers should `Astro.redirect('/results')` in that case.
 */
export async function loadTestResult(
  Astro: AstroGlobal,
): Promise<TestResultBase | null> {
  const testId = Astro.params.testId as string | undefined;
  if (!testId) return null;

  const env = (Astro.locals as any).runtime.env;
  const prisma = getPrismaClient(Astro);
  const test = await getTestById(prisma, testId);
  if (!test) return null;

  const aiEnabled = env.ENABLE_AI_RATING === 'true';
  const isUnknown =
    aiEnabled &&
    (test.content_rating === ContentRating.UNKNOWN ||
      test.content_rating === ContentRating.IN_PROGRESS);
  const isUnsafe = aiEnabled && test.content_rating === ContentRating.UNSAFE;

  // Screenshot — just check existence, don't download the image
  const screenshotKey = `${testId}/screenshot.png`;
  const hasScreenshot = await r2Exists(env.RESULTS_BUCKET, screenshotKey);
  const screenshotUrl = hasScreenshot
    ? `/api/tests/${testId}/screenshot.png`
    : null;

  // HAR browser info + existence check.
  // The full HAR is cached so subsequent reads (e.g. waterfall tab client
  // fetching the same file via the API route) can skip re-parsing.
  let harBrowser: { name: string; version: string } | null = null;
  let hasHar = false;
  const harKey = `${testId}/pageload.har`;
  const har = await getR2Json<{
    log: { browser: { name: string; version: string } };
  }>(env.RESULTS_BUCKET, harKey);
  if (har) {
    hasHar = true;
    harBrowser = har?.log?.browser ?? null;
  }

  // Formatted date
  const date = new Date(test.test_date * 1000);
  const formattedDate = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return {
    testId,
    test,
    isUnknown,
    isUnsafe,
    screenshotUrl,
    harBrowser,
    hasHar,
    formattedDate,
  };
}
