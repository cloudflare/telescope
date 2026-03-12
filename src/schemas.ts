import { z } from 'zod';

export const CookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
  url: z.string().optional(),
}).passthrough();

export const CookiesSchema = z.union([z.array(CookieSchema), CookieSchema]);

export const HeadersSchema = z.record(z.string(), z.string());

export const AuthSchema = z.object({
  username: z.string(),
  password: z.string(),
  origin: z.string().optional(),
  send: z.enum(['unauthorized', 'always']).optional(),
});

export const FirefoxPrefsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
);

export const OverrideHostSchema = z.record(z.string(), z.string());

export const DelaySchema = z.record(z.string(), z.number());

export const StringArraySchema = z.array(z.string());

export const PositiveIntSchema = z.coerce.number().int().positive();
export const PositiveFloatSchema = z.coerce.number().positive();
