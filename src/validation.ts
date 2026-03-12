import { ZodError, type ZodSchema, type ZodType } from 'zod';

export function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `  - ${path}: ${issue.message}`;
    })
    .join('\n');
}

// JSON.parse then schema validation. Throws with flagName context on failure.
export function parseCLIOption<T>(
  flagName: string,
  jsonString: string,
  schema: ZodSchema<T>,
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(
      `Invalid JSON for "${flagName}": ${(err as SyntaxError).message}`,
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid data for "${flagName}":\n${formatZodError(result.error)}`,
    );
  }

  return result.data;
}

// Schema-only validation for already-parsed data.
export function parseUnknown<T>(
  flagName: string,
  data: unknown,
  schema: ZodSchema<T>,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `Invalid data for "${flagName}":\n${formatZodError(result.error)}`,
    );
  }

  return result.data;
}

// Coerce+validate a raw CLI string via a Zod schema.
// Throws with a flag-contextual message on failure.
export function parseWithSchema<T>(schema: ZodType<T>, value: string, flag: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`'${value}' is not a valid ${flag} value.`);
  }
  return result.data;
}
