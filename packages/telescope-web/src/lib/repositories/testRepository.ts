import type { TestStore } from '@/lib/storage/types';
import type { ContentRating, TestConfig, Tests } from '@/lib/types/tests';

/** Creates a test metadata record. */
export async function createTest(
  store: TestStore,
  testConfig: TestConfig,
): Promise<void> {
  await store.create(testConfig);
}

/** Finds a test by its uploaded archive hash. */
export async function findTestIdByZipKey(
  store: TestStore,
  zipKey: string,
): Promise<{ testId: string; contentRating: string } | null> {
  return await store.findByZipKey(zipKey);
}

/** Finds a single test by its test ID. */
export async function getTestById(
  store: TestStore,
  testId: string,
): Promise<Tests | null> {
  return await store.getById(testId);
}

/** Returns tests ordered with the newest upload first. */
export async function getAllTests(
  store: TestStore,
  aiEnabled: boolean,
): Promise<Tests[]> {
  return await store.getAll(aiEnabled);
}

/** Returns the content rating and URL for a single test. */
export async function getTestRating(
  store: TestStore,
  testId: string,
): Promise<{ rating: string; url: string } | null> {
  return await store.getRating(testId);
}

/** Updates the content rating for a test. */
export async function updateContentRating(
  store: TestStore,
  testId: string,
  rating: ContentRating,
): Promise<void> {
  await store.updateRating(testId, rating);
}
