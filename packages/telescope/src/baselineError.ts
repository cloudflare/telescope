const URL_IN_ERROR_PATTERN = /https?:\/\/[^\s"'<>]+/gi;

/**
 * Formats an error for Baseline diagnostics without exposing URLs that may
 * contain credentials or tokens.
 *
 * @param error - The caught value to format.
 * @returns An error name and message with HTTP(S) URLs redacted.
 */
export function formatBaselineError(error: unknown): string {
  try {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const message = error instanceof Error ? error.message : String(error);
    return `${redactURLs(errorName)}: ${redactURLs(message)}`;
  } catch {
    return 'UnknownError: [unprintable thrown value]';
  }
}

function redactURLs(value: string): string {
  return value.replace(URL_IN_ERROR_PATTERN, '[redacted URL]');
}
