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

  constructor(csvContents: string[]) {
    this.parseCSVs(csvContents);
  }

  private parseCSVs(contents: string[]) {
    const dataMap = new Map<number, DataPoint>();

    for (const content of contents) {
      this.parseSingleCSV(content, dataMap);
    }

    // Convert Map back to array and sort
    this.data = Array.from(dataMap.values());
    this.data.sort((a, b) => a.last_changed.valueOf() - b.last_changed.valueOf());
  }

  private parseSingleCSV(content: string, dataMap: Map<number, DataPoint>) {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return;

    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map(h => h.trim());

    const stateIndex = headers.indexOf('state');
    const lastChangedIndex = headers.indexOf('last_changed');

    if (stateIndex === -1 || lastChangedIndex === -1) {
      throw new Error('CSV must contain "state" and "last_changed" columns in the header.');
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const columns = line.split(',');
      
      const stateStr = columns[stateIndex]?.trim();
      const dateStr = columns[lastChangedIndex]?.trim();
      
      if (!stateStr || !dateStr) continue;

      const state = parseFloat(stateStr);
      const last_changed = dayjs.utc(dateStr); 

      if (!isNaN(state) && last_changed.isValid()) {
        // Deduplicate by timestamp (valueOf())
        dataMap.set(last_changed.valueOf(), { state, last_changed });
      }
    }
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
