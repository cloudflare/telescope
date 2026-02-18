import type { APIContext } from 'astro';

export function getPrismaClient(context: APIContext) {
  if (!context.locals.prisma) {
    throw new Error('Database connection not available');
  }
  return context.locals.prisma;
}
