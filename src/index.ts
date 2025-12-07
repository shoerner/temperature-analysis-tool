import fs from 'fs';
import path from 'path';
import { Analyzer, DailyStats, ZERO_THRESHOLD } from './analyzer';

function run() {
  const filePaths = process.argv.slice(2);

  if (filePaths.length === 0) {
    console.error('Please provide at least one file path');
    process.exit(1);
  }

  try {
    const fileContents: string[] = [];

    for (const filePath of filePaths) {
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
          console.error(`File not found: ${absolutePath}`);
          process.exit(1);
        }
        const content = fs.readFileSync(absolutePath, 'utf-8');
        fileContents.push(content);
    }

    const analyzer = new Analyzer(fileContents);
    const result = analyzer.analyze();

    // Generate CSV Output
    const rows: string[] = [];
    rows.push(`Metric,Date,Value,Time Below ${ZERO_THRESHOLD} (min),Time Below ${ZERO_THRESHOLD} (%),Time Above ${ZERO_THRESHOLD} (min),Time Above ${ZERO_THRESHOLD} (%)`);

    // 1. Overall Average Temp
    rows.push(`Overall Average Temp,,${result.overallAverageTemp.toFixed(2)},,,,`);

    // 2. Daily Average Temps
    const dates = Object.keys(result.dailyStats).sort();
    
    let totalTimeBelowZeroMs = 0;
    let maxTimeBelowZeroMs = 0;

    for (const date of dates) {
        const stats = result.dailyStats[date];
        
        // Daily Average Temp
        const dailyAvg = stats.totalDurationMs > 0 ? stats.weightedTempSum / stats.totalDurationMs : 0;
        const timeBelowMin = stats.timeBelowThresholdMs / 60000;
        const timeAboveMin = (stats.totalDurationMs - stats.timeBelowThresholdMs) / 60000;

        const percentBelow = Math.round((timeBelowMin / 1440) * 100);
        const percentAbove = Math.round((timeAboveMin / 1440) * 100);

        rows.push(`Daily Average Temp,${date},${dailyAvg.toFixed(2)},${timeBelowMin.toFixed(2)},${percentBelow}%,${timeAboveMin.toFixed(2)},${percentAbove}%`);

        // Accumulate for other stats
        totalTimeBelowZeroMs += stats.timeBelowThresholdMs;
        if (stats.timeBelowThresholdMs > maxTimeBelowZeroMs) {
            maxTimeBelowZeroMs = stats.timeBelowThresholdMs;
        }
    }

    const numberOfDays = dates.length;
    const avgTimeBelowZeroMs = numberOfDays > 0 ? totalTimeBelowZeroMs / numberOfDays : 0;

    // Convert to Minutes
    const avgTimeBelowZeroMin = avgTimeBelowZeroMs / 60000;
    const maxTimeBelowZeroMin = maxTimeBelowZeroMs / 60000;

    // 3. Average time spent under 0 degrees daily (minutes)
    rows.push(`Average time spent under ${ZERO_THRESHOLD} degrees daily (minutes),,${avgTimeBelowZeroMin.toFixed(2)},,,,`);

    // 4. Maximum time over the provided period spent under 0 degrees (minutes)
    rows.push(`Maximum time over the provided period spent under ${ZERO_THRESHOLD} degrees (minutes),,${maxTimeBelowZeroMin.toFixed(2)},,,,`);

    // Use CRLF for better Excel compatibility and prepend BOM
    const csvContent = '\uFEFF' + rows.join('\r\n');
    
    const outputPath = path.join('output', `${(new Date()).toISOString().replace(/:/g, '')}.csv`);
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
    console.log(`Analysis complete. Output written to ${outputPath}`);

  } catch (error) {
    console.error('Error processing file:', error);
    process.exit(1);
  }
}

run();
