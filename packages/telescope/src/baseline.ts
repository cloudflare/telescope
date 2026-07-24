import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { getPackageVersion } from './packageVersion.js';
import type { BaselinePipelineOptions, JsonValue } from './types.js';

const BASELINE_SCHEMA_VERSION = 1;

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  return value;
}

/**
 * Writes a deterministic JSON artifact beneath the results baseline directory.
 * @param resultsPath - Directory containing the performance test results.
 * @param artifactPath - Path relative to the baseline directory.
 * @param artifact - JSON-compatible artifact content.
 * @throws If the artifact path escapes the baseline directory or writing fails.
 */
export function writeBaselineArtifact(
  resultsPath: string,
  artifactPath: string,
  artifact: JsonValue,
): void {
  const baselinePath = path.resolve(resultsPath, 'baseline');
  const outputPath = path.resolve(baselinePath, artifactPath);
  if (
    outputPath !== baselinePath &&
    !outputPath.startsWith(baselinePath + path.sep)
  ) {
    throw new Error(`Invalid baseline artifact path: ${artifactPath}`);
  }

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(sortJson(artifact)), 'utf8');
}

/**
 * Runs the post-performance Baseline analysis pipeline.
 *
 * Detection and analysis stages will be added incrementally. The initial
 * pipeline writes only a run manifest to establish the artifact contract.
 *
 * @param options - Completed test URL and results location.
 */
export async function runBaselinePipeline(
  options: BaselinePipelineOptions,
): Promise<void> {
  const meta = {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    telescopeVersion: getPackageVersion(),
    timestamp: new Date().toISOString(),
    url: options.url,
  };

  writeBaselineArtifact(options.resultsPath, 'meta.json', meta);
}
