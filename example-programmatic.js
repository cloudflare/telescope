import { launchTest } from './index.js';

console.log('Testing programmatic API...\n');

const result = await launchTest({
  url: 'https://example.com',
  browser: 'chrome',
  width: 1366,
  height: 768,
});

if (result.success) {
  console.log('✓ Test completed successfully');
  console.log(`  Test ID: ${result.testId}`);
  console.log(`  Results: ${result.resultsPath}`);
} else {
  console.error('✗ Test failed');
  console.error(`  Error: ${result.error}`);
  process.exit(1);
}
