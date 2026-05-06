/// <reference types="@/generated/prisma/client" />

// In cloudflare mode, App.Locals extends the Workers Runtime (env, cf, ctx).
// In local mode, those bindings are absent and `prisma` is null.
// We declare the union here so both targets type-check the same source.
type CloudflareRuntime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Partial<CloudflareRuntime> {
    /** Cloudflare D1 client. `null` in local mode. */
    prisma: import('@/generated/prisma/client').PrismaClient | null;
    /** Active storage provider (filesystem or R2), set by middleware. */
    storage: import('@/lib/storage/storage').IStorage;
    /** Active test metadata store (filesystem or D1), set by middleware. */
    testStore: import('@/lib/repositories/testStore').ITestStore;
    /** Current runtime mode. */
    mode: import('@/lib/config/mode').TelescopeMode;
  }
}
