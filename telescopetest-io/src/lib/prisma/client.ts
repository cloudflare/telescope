import type { APIContext, AstroGlobal } from 'astro';

export function getPrismaClient(context: APIContext | AstroGlobal) {
  if (!context.locals.prisma) {
    throw new Error('Database connection not available');
  }
  return context.locals.prisma;
}
