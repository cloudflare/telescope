/**
 * Test repository - handles all database operations for tests
 * Encapsulates Prisma queries for better separation of concerns
 */

import type { PrismaClient } from '@/generated/prisma/client';
import type { TestConfig } from '@/lib/classes/TestConfig';

/**
 * Create a new test in the database
 */
export async function createTest(
  prisma: PrismaClient,
  testConfig: TestConfig,
): Promise<void> {
  await prisma.test.create({
    data: {
      testId: testConfig.testId,
      zipKey: testConfig.zipKey,
      name: testConfig.name,
      description: testConfig.description,
      source: testConfig.source,
      url: testConfig.url,
      testDate: testConfig.testDate,
      browser: testConfig.browser,
    },
  });
}

/**
 * Find a test by its zipKey (content hash)
 * Returns testId if found, null otherwise
 */
export async function findTestIdByZipKey(
  prisma: PrismaClient,
  zipKey: string,
): Promise<string | null> {
  const test = await prisma.test.findUnique({
    where: { zipKey },
    select: { testId: true },
  });
  return test?.testId ?? null;
}
