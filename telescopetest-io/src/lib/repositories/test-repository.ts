/**
 * Test repository - handles all database operations for tests
 * Encapsulates Prisma queries for better separation of concerns
 */

import type { PrismaClient } from '@/generated/prisma/client';
import type { TestConfig, Tests } from '@/lib/classes/TestConfig';

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
  const test = await prisma.tests.findUnique({
    where: { zip_key: zipKey },
    select: { test_id: true },
  });
  return test?.test_id ?? null;
}

/**
 * Find all tests
 * Returns rows as Tests type
 */
export async function getAllTests(prisma: PrismaClient): Promise<Tests[]> {
  const rows = await prisma.tests.findMany({
    select: {
      test_id: true,
      url: true,
      test_date: true,
      browser: true,
      name: true,
      description: true,
    },
    orderBy: { created_at: 'desc' },
  });
  return rows;
}
