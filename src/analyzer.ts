import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

// 1. Magic String Configuration
export const ZERO_THRESHOLD = 0; // "magic string" (number in this case)

export interface DataPoint {
  state: number;
  last_changed: Dayjs;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  totalDurationMs: number;
  weightedTempSum: number;
  timeBelowThresholdMs: number;
}

export interface AnalysisResult {
  overallAverageTemp: number;
  dailyStats: Record<string, DailyStats>;
}

export class Analyzer {
  private data: DataPoint[] = [];

  constructor(csvContent: string) {
    this.parseCSV(csvContent);
  }

  private parseCSV(content: string) {
    const lines = content.trim().split('\n');
    // Assume header exists and skip it
    const startIdx = lines[0].startsWith('state') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const [stateStr, dateStr] = line.split(',');
      
      const state = parseFloat(stateStr);
      const last_changed = dayjs.utc(dateStr); // Input is UTC

      if (!isNaN(state) && last_changed.isValid()) {
        this.data.push({ state, last_changed });
      }
    }

    // Sort by time just in case
    this.data.sort((a, b) => a.last_changed.valueOf() - b.last_changed.valueOf());
  }

  public analyze(): AnalysisResult {
    const dailyStats: Record<string, DailyStats> = {};
    let globalWeightedSum = 0;
    let globalDuration = 0;

    // We iterate from 0 to length - 1 because the last point just marks the end of the previous interval
    for (let i = 0; i < this.data.length - 1; i++) {
      const current = this.data[i];
      const next = this.data[i + 1];

      const start = current.last_changed;
      const end = next.last_changed;
      const temp = current.state;

      // Calculate total duration for this interval
      const intervalDuration = end.diff(start); 
      
      if (intervalDuration <= 0) continue; // Should not happen if sorted and distinct

      globalDuration += intervalDuration;
      globalWeightedSum += intervalDuration * temp;

      // Process daily splits
      let cursor = start;
      while (cursor.isBefore(end)) {
        // Determine the end of the current day for the cursor
        // cursor is UTC.
        // end of day is 23:59:59.999... effectively start of next day 00:00
        const nextDayStart = cursor.add(1, 'day').startOf('day');
        
        // The segment ends at either the interval end or the day boundary
        const segmentEnd = nextDayStart.isBefore(end) ? nextDayStart : end;
        const segmentDuration = segmentEnd.diff(cursor);

        if (segmentDuration > 0) {
          const dayKey = cursor.format('YYYY-MM-DD');

          if (!dailyStats[dayKey]) {
            dailyStats[dayKey] = {
              date: dayKey,
              totalDurationMs: 0,
              weightedTempSum: 0,
              timeBelowThresholdMs: 0
            };
          }

          dailyStats[dayKey].totalDurationMs += segmentDuration;
          dailyStats[dayKey].weightedTempSum += (segmentDuration * temp);
          
          if (temp < ZERO_THRESHOLD) {
            dailyStats[dayKey].timeBelowThresholdMs += segmentDuration;
          }
        }

        cursor = segmentEnd;
      }
    }

    const overallAverageTemp = globalDuration > 0 ? globalWeightedSum / globalDuration : 0;

    return {
      overallAverageTemp,
      dailyStats
    };
  }
}
