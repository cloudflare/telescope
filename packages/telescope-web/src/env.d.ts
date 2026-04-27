/// <reference types="@/generated/prisma/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    prisma: import('@/generated/prisma/client').PrismaClient | null;
  }
}
