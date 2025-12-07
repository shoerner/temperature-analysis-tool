import { Analyzer, ZERO_THRESHOLD } from '../src/analyzer';
import assert from 'assert';

console.log('Running Analyzer Tests...');

// Helper to create a CSV string
const createCSV = (rows: Array<[string, string]>) => {
  return 'state,last_changed\n' + rows.map(r => `${r[0]},${r[1]}`).join('\n');
};

const runTest = () => {
  // Test Case:
  // 00:00 - 06:00:  10 deg (Above)
  // 06:00 - 12:00: -5 deg (Below)
  // 12:00 - 18:00:  0 deg (Boundary - Currently Above, Request to be Below)
  // 18:00 - 00:00:  5 deg (Above)

  // Timestamps (Using a fixed date 2023-01-01)
  const csvContent = createCSV([
    ['10', '2023-01-01T00:00:00Z'],
    ['-5', '2023-01-01T06:00:00Z'],
    ['0',  '2023-01-01T12:00:00Z'],
    ['5',  '2023-01-01T18:00:00Z'],
    ['5',  '2023-01-02T00:00:00Z'] // Closing the interval for the last segment
  ]);

  const analyzer = new Analyzer([csvContent]);
  const result = analyzer.analyze();

  const dayStats = result.dailyStats['2023-01-01'];

  assert(dayStats, 'Stats for 2023-01-01 should exist');

  const totalDurationMin = dayStats.totalDurationMs / 60000;
  assert.strictEqual(totalDurationMin, 24 * 60, 'Total duration should be 24 hours');

  const timeBelowMin = dayStats.timeBelowThresholdMs / 60000;

  // Current logic: < 0.
  // -5 is below (6 hours)
  // 0 is NOT below (6 hours)
  // So expected current: 6 * 60 = 360 mins.

  // Desired logic: <= 0.
  // -5 is below (6 hours)
  // 0 is below (6 hours)
  // So expected new: 12 * 60 = 720 mins.

  console.log(`Time Below Threshold (min): ${timeBelowMin}`);

  if (timeBelowMin === 360) {
      console.log('PASS (Current Behavior): Only strictly below 0 is counted.');
  } else if (timeBelowMin === 720) {
      console.log('PASS (New Behavior): 0 and below are counted.');
  } else {
      console.error(`FAIL: Unexpected time below threshold: ${timeBelowMin}`);
      process.exit(1);
  }
};

runTest();
