import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { getPackageVersion } from './packageVersion.js';
import type { BaselinePipelineOptions, JSONValue } from './types.js';

export const BASELINE_SCHEMA_VERSION = 1;

/**
 * Writes a JSON artifact beneath the results baseline directory.
 * @param resultsPath - Directory containing the performance test results.
 * @param artifactPath - Path relative to the baseline directory.
 * @param artifact - JSON-compatible artifact content.
 * @throws If the artifact path escapes the baseline directory or writing fails.
 */
export function writeBaselineArtifact(
  resultsPath: string,
  artifactPath: string,
  artifact: JSONValue,
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
  writeFileSync(outputPath, JSON.stringify(artifact), 'utf8');
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
