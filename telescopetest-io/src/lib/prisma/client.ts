import { PrismaClient } from '@/generated/prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
/**
 * Creates a Prisma Client instance with D1 adapter
 * Based on: https://www.prisma.io/docs/guides/cloudflare-d1#6-implement-the-worker
 *
 * @param db - D1Database binding from context.locals.runtime.env.TELESCOPE_DB
 * @returns Configured Prisma Client instance
 *
 * @example
 * const prisma = createPrismaClient(context.locals.runtime.env.TELESCOPE_DB);
 * const tests = await prisma.test.findMany();
 * await prisma.$disconnect();
 */
export function createPrismaClient(db: D1Database) {
  const adapter = new PrismaD1(db);
  return new PrismaClient({ adapter });
}

/*
// Usage:
const prisma = createPrismaClient(context.locals.runtime.env.TELESCOPE_DB);
const tests = await prisma.test.findMany();
await prisma.$disconnect();
*/
