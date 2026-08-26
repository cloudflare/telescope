import type { APIContext, AstroGlobal } from 'astro';

import type { RuntimeServices } from '@/lib/storage/types';

/** Returns the storage services selected for the current build target. */
export function getRuntimeServices(
  context: APIContext | AstroGlobal,
): RuntimeServices {
  if (!context.locals.services) {
    throw new Error('Runtime storage services are not available');
  }
  return context.locals.services;
}
