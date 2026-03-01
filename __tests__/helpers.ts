import fs from 'fs';
import path from 'path';
import type {
  HarData,
  Metrics,
  ResourceTiming,
  SavedConfig,
} from '../src/types.js';

type ResultType = 'result' | 'config' | 'metrics' | 'resources';

export function retrieveResults<T>(
  testId: string | undefined,
  fileName: string,
  resultType: ResultType,
): T | null {
  if (!testId) {
    console.error('Invalid test id:', testId);
    return null;
  }

  const rootPath = 'results/';
  const safeTestPath = path.normalize(testId).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(rootPath, safeTestPath, fileName);

  if (filePath.indexOf(rootPath) !== 0) {
    console.error('Invalid test', resultType, filePath);
    return null;
  }

  try {
    const fileData = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(fileData) as T;
    return json;
  } catch (error) {
    console.error(
      'Error retrieving',
      resultType,
      'for test',
      testId,
      ':',
      error,
    );
    return null;
  }
}

export function retrieveHAR(testId: string | undefined): HarData | null {
  return retrieveResults<HarData>(testId, 'pageload.har', 'result');
}

export function retrieveConfig(testId: string | undefined): SavedConfig | null {
  return retrieveResults<SavedConfig>(testId, 'config.json', 'config');
}

export function retrieveMetrics(testId: string | undefined): Metrics | null {
  return retrieveResults<Metrics>(testId, 'metrics.json', 'metrics');
}

export function retrieveResources(
  testId: string | undefined,
): ResourceTiming[] | null {
  return retrieveResults<ResourceTiming[]>(
    testId,
    'resources.json',
    'resources',
  );
}
