/**
 * D1TestStore — Prisma/D1-backed implementation of ITestStore.
 *
 * Wraps the existing testRepository.ts functions. Used when
 * TELESCOPE_MODE=cloudflare (default).
 *
 * Loaded via dynamic import from the storage factory so the Prisma
 * runtime is not pulled into the local Node bundle.
 */

import type { PrismaClient } from '@/generated/prisma/client';
import type { TestConfig, Tests } from '@/lib/types/tests';
import { ContentRating } from '@/lib/types/tests';

import {
  createTest,
  findTestIdByZipKey,
  getAllTests,
  getTestById,
  getTestRating,
  updateContentRating,
} from './testRepository.js';

import type { ITestStore } from './testStore.js';

export class D1TestStore implements ITestStore {
  constructor(private prisma: PrismaClient) {}

  async getAll(aiEnabled: boolean): Promise<Tests[]> {
    return getAllTests(this.prisma, aiEnabled);
  }

  async getById(testId: string): Promise<Tests | null> {
    return getTestById(this.prisma, testId);
  }

  async getRating(
    testId: string,
  ): Promise<{ rating: string; url: string } | null> {
    return getTestRating(this.prisma, testId);
  }

  async create(testConfig: TestConfig): Promise<void> {
    await createTest(this.prisma, testConfig);
  }

  async findByZipKey(
    zipKey: string,
  ): Promise<{ testId: string; contentRating: string } | null> {
    return findTestIdByZipKey(this.prisma, zipKey);
  }

  async findByTestId(
    testId: string,
  ): Promise<{ testId: string; contentRating: string } | null> {
    const row = await getTestById(this.prisma, testId);
    if (!row) return null;
    return { testId: row.test_id, contentRating: row.content_rating };
  }

  async updateContentRating(
    testId: string,
    rating: ContentRating,
  ): Promise<void> {
    await updateContentRating(this.prisma, testId, rating);
  }
}
