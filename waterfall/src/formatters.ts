/**
 * Human-readable byte sizes and millisecond durations for the waterfall.
 */

export function fmtSize(bytes: number): string {
  if (bytes <= 0) return '-';
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

export function fmtMs(ms: number): string {
  return ms <= 0 ? '-' : `${Math.round(ms)} ms`;
}
