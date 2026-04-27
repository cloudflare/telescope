import { defineMiddleware } from 'astro:middleware';
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from 'cloudflare:workers';

let prisma: PrismaClient | null = null;

export const onRequest = defineMiddleware(async (context, next) => {
  const d1_database = env.TELESCOPE_DB;
  if (!prisma) {
    const adapter = new PrismaD1(d1_database);
    prisma = new PrismaClient({ adapter });
  }
  context.locals.prisma = prisma;
  return next();
});
