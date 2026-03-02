/**
 * Test repository - handles all database operations for tests
 * Encapsulates Prisma queries for better separation of concerns
 */

import type { PrismaClient } from '@/generated/prisma/client';
import type { TestConfig, Tests } from '@/lib/classes/TestConfig';
import { ContentRating } from '@/lib/classes/TestConfig';

/**
 * Create a new test in the database
 */
export async function createTest(
  prisma: PrismaClient,
  testConfig: TestConfig,
): Promise<void> {
  await prisma.tests.create({
    data: {
      test_id: testConfig.testId,
      zip_key: testConfig.zipKey,
      name: testConfig.name,
      description: testConfig.description,
      source: testConfig.source,
      url: testConfig.url,
      test_date: testConfig.testDate,
      browser: testConfig.browser,
      content_rating: ContentRating.UNKNOWN,
    },
  });
}

/**
 * Find a test by its zipKey (content hash)
 * Returns testId and contentRating if found, null otherwise
 */
export async function findTestIdByZipKey(
  prisma: PrismaClient,
  zipKey: string,
): Promise<{ testId: string; contentRating: string } | null> {
  const test = await prisma.tests.findUnique({
    where: { zip_key: zipKey },
    select: { test_id: true, content_rating: true },
  });
  if (!test) return null;
  return { testId: test.test_id, contentRating: test.content_rating };
}

/**
 * Find a single test by its testId
 * Returns the test or null if not found
 */
export async function getTestById(
  prisma: PrismaClient,
  testId: string,
): Promise<Tests | null> {
  const row = await prisma.tests.findUnique({
    where: { test_id: testId },
    select: {
      test_id: true,
      url: true,
      test_date: true,
      browser: true,
      name: true,
      description: true,
      content_rating: true,
    },
  });
  return row ?? null;
}

/**
 * Find all tests.
 * When AI rating is enabled, only safe tests are returned.
 * When AI rating is disabled, all tests are returned regardless of rating.
 */
export async function getAllTests(
  prisma: PrismaClient,
  aiEnabled: boolean,
): Promise<Tests[]> {
  const rows = await prisma.tests.findMany({
    where: aiEnabled ? { content_rating: ContentRating.SAFE } : undefined,
    select: {
      test_id: true,
      url: true,
      test_date: true,
      browser: true,
      name: true,
      description: true,
      content_rating: true,
    },
    orderBy: { created_at: 'desc' },
  });
  return rows;
}

/**
 * Get the content_rating and url for a single test.
 * Used by the rating endpoint to check rating and re-trigger AI if still unknown.
 */
export async function getTestRating(
  prisma: PrismaClient,
  testId: string,
): Promise<{ rating: string; url: string } | null> {
  const row = await prisma.tests.findUnique({
    where: { test_id: testId },
    select: { content_rating: true, url: true },
  });
  if (!row) return null;
  return { rating: row.content_rating, url: row.url };
}

/**
 * Update the content_rating for a test using Workers AI classification
 */
export async function updateContentRating(
  prisma: PrismaClient,
  testId: string,
  rating: ContentRating,
): Promise<void> {
  await prisma.tests.update({
    where: { test_id: testId },
    data: { content_rating: rating },
  });
}
