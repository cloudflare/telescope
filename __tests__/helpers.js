import fs from 'fs';
import path from 'path';

export function retrieveResults(testId, fileName, resultType) {
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
    const json = JSON.parse(fileData);
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

export function retrieveHAR(testId) {
  return retrieveResults(testId, 'pageload.har', 'result');
}

export function retrieveConfig(testId) {
  return retrieveResults(testId, 'config.json', 'config');
}

export function retrieveMetrics(testId) {
  return retrieveResults(testId, 'metrics.json', 'metrics');
}
