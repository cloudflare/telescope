import { defineMiddleware } from 'astro:middleware';

import { getMode } from '@/lib/config/mode';
import { getStorage, getTestStore } from '@/lib/storage/factory';
import type { PrismaClient } from '@/generated/prisma/client';

// Cached Prisma client — only initialised in cloudflare mode.
let prisma: PrismaClient | null = null;

export const onRequest = defineMiddleware(async (context, next) => {
  const mode = getMode();
  context.locals.mode = mode;

  if (mode === 'cloudflare') {
    if (!prisma) {
      // Dynamic import keeps Cloudflare-specific modules out of the
      // local Node bundle.
      const [{ env }, { PrismaD1 }, { PrismaClient: PrismaCtor }] =
        await Promise.all([
          import('cloudflare:workers'),
          import('@prisma/adapter-d1'),
          import('@/generated/prisma/client'),
        ]);
      const adapter = new PrismaD1(env.TELESCOPE_DB!);
      prisma = new PrismaCtor({ adapter });
    }
    context.locals.prisma = prisma;
  } else {
    context.locals.prisma = null;
  }

  context.locals.storage = await getStorage();
  context.locals.testStore = await getTestStore(context.locals.prisma);

  return next();
});
