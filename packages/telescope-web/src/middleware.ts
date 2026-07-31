import { defineMiddleware } from 'astro:middleware';
import { createRuntimeServices } from '@/lib/runtime/current';

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.services = await createRuntimeServices(context);
  return next();
});
