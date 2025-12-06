import fs from 'fs';
import path from 'path';
import { Analyzer, DailyStats, ZERO_THRESHOLD } from './analyzer';

function run() {
  const args = process.argv.slice(2);
  const filePath = args[0];

  if (!filePath) {
    console.error('Please provide a file path');
    process.exit(1);
  }

  try {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`File not found: ${absolutePath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const analyzer = new Analyzer(content);
    const result = analyzer.analyze();

    // Generate CSV Output
    const rows: string[] = [];
    rows.push('Metric,Date,Value');

    // 1. Overall Average Temp
    rows.push(`Overall Average Temp,,${result.overallAverageTemp.toFixed(2)}`);

    // 2. Daily Average Temps
    const dates = Object.keys(result.dailyStats).sort();
    
    // We also need to calculate "Average time spent under 0 degrees daily"
    // This is: Sum of all daily durations < 0 / Number of days recorded
    // Note: Should we count days where time < 0 is 0? Yes, if the day is in the dataset.
    // The prompt says "Average time spent under 0 degrees Fahrenheit ... daily".
    // This usually implies average per day.
    
    let totalTimeBelowZero = 0;
    let maxTimeBelowZero = 0;

    for (const date of dates) {
        const stats = result.dailyStats[date];
        
        // Daily Average Temp
        const dailyAvg = stats.totalDurationMs > 0 ? stats.weightedTempSum / stats.totalDurationMs : 0;
        rows.push(`Daily Average Temp,${date},${dailyAvg.toFixed(2)}`);

        // Accumulate for other stats
        totalTimeBelowZero += stats.timeBelowThresholdMs;
        if (stats.timeBelowThresholdMs > maxTimeBelowZero) {
            maxTimeBelowZero = stats.timeBelowThresholdMs;
        }
    }

    const numberOfDays = dates.length;
    const avgTimeBelowZero = numberOfDays > 0 ? totalTimeBelowZero / numberOfDays : 0;

    // 3. Average time spent under 0 degrees daily
    rows.push(`Average time spent under ${ZERO_THRESHOLD} degrees daily,,${avgTimeBelowZero.toFixed(0)}`);

    // 4. Maximum time over the provided period spent under 0 degrees
    rows.push(`Maximum time over the provided period spent under ${ZERO_THRESHOLD} degrees,,${maxTimeBelowZero.toFixed(0)}`);

    console.log(rows.join('\n'));

  } catch (error) {
    console.error('Error processing file:', error);
    process.exit(1);
  }
}

run();
