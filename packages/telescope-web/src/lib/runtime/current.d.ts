import type { APIContext } from 'astro';

import type { RuntimeServices } from '@/lib/storage/types';

export function createRuntimeServices(
  context: APIContext,
): Promise<RuntimeServices>;
