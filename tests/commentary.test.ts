// Unit Tests: Data-Driven Report Commentary

import { describe, it, expect } from 'vitest';
import { buildDataDrivenCommentary } from '../src/server/services/commentary.js';
import { NormalizedReportData } from '../src/types/index.js';

function makeData(overrides?: Partial<NormalizedReportData>): NormalizedReportData {
  return {
    kpis: {
      clicks: { current: 12000, previous: 0, changePercent: 100, formattedCurrent: '12,000', formattedPrevious: '0' },
      impressions: { current: 80000, previous: 0, changePercent: 100, formattedCurrent: '80,000', formattedPrevious: '0' },
      ctr: { current: 15, previous: 0, changePercent: 100, formattedCurrent: '15.00%', formattedPrevious: '0.00%' },
      avgPosition: { current: 12.4, previous: 0, changePercent: 0, formattedCurrent: '12.4', formattedPrevious: '0.0' },
      organicSessions: { current: 9800, previous: 0, changePercent: 100, formattedCurrent: '9,800', formattedPrevious: '0' }
    },
    topQueries: [],
    topPages: [],
    topGainers: [],
    topLosers: [],
    ...overrides
  };
}

describe('buildDataDrivenCommentary', () => {
  it('states measured figures and explicitly flags a missing previous period', () => {
    const commentary = buildDataDrivenCommentary(makeData(), 'September 2026');

    expect(commentary.executiveSummary).toContain('Organic search delivered 12,000 clicks and 80,000 impressions during September 2026.');
    expect(commentary.executiveSummary).toContain('No previous-period data was provided, so month-over-month changes could not be measured.');
  });

  it('reports month-over-month deltas when previous-period data exists', () => {
    const data = makeData({
      kpis: {
        clicks: { current: 12000, previous: 10000, changePercent: 20, formattedCurrent: '12,000', formattedPrevious: '10,000' },
        impressions: { current: 80000, previous: 82000, changePercent: -2.44, formattedCurrent: '80,000', formattedPrevious: '82,000' },
        ctr: { current: 15, previous: 12.2, changePercent: 22.95, formattedCurrent: '15.00%', formattedPrevious: '12.20%' },
        avgPosition: { current: 10.5, previous: 12.4, changePercent: -15.32, formattedCurrent: '10.5', formattedPrevious: '12.4' },
        organicSessions: { current: 9800, previous: 9100, changePercent: 7.69, formattedCurrent: '9,800', formattedPrevious: '9,100' }
      }
    });

    const commentary = buildDataDrivenCommentary(data, 'September 2026');

    expect(commentary.executiveSummary).toContain('clicks ↑ +20.0%');
    expect(commentary.executiveSummary).toContain('impressions ↓ -2.4%');
    expect(commentary.executiveSummary).toContain('CTR ↑ +22.9%');
    expect(commentary.executiveSummary).toContain('Average ranking position improved to 10.5');
    expect(commentary.executiveSummary).toContain('Organic sessions ↑ +7.7% to 9,800');
    // No false "no previous-period" claim once deltas exist.
    expect(commentary.executiveSummary).not.toContain('No previous-period data was provided');
  });

  it('describes a steady ranking position neutrally', () => {
    const data = makeData({
      kpis: {
        clicks: { current: 100, previous: 95, changePercent: 5.26, formattedCurrent: '100', formattedPrevious: '95' },
        impressions: { current: 500, previous: 480, changePercent: 4.17, formattedCurrent: '500', formattedPrevious: '480' },
        ctr: { current: 20, previous: 19.8, changePercent: 1.01, formattedCurrent: '20.00%', formattedPrevious: '19.80%' },
        avgPosition: { current: 8.1, previous: 8.1, changePercent: 0, formattedCurrent: '8.1', formattedPrevious: '8.1' },
        organicSessions: { current: 90, previous: 88, changePercent: 2.27, formattedCurrent: '90', formattedPrevious: '88' }
      }
    });

    const summary = buildDataDrivenCommentary(data, 'September 2026').executiveSummary;
    expect(summary).toContain('Average ranking position held steady at 8.1.');
  });

  it('describes a ranking slip honestly', () => {
    const data = makeData({
      kpis: {
        clicks: { current: 100, previous: 95, changePercent: 5.26, formattedCurrent: '100', formattedPrevious: '95' },
        impressions: { current: 500, previous: 480, changePercent: 4.17, formattedCurrent: '500', formattedPrevious: '480' },
        ctr: { current: 20, previous: 19.8, changePercent: 1.01, formattedCurrent: '20.00%', formattedPrevious: '19.80%' },
        avgPosition: { current: 15.2, previous: 11.0, changePercent: 38.18, formattedCurrent: '15.2', formattedPrevious: '11.0' },
        organicSessions: { current: 90, previous: 88, changePercent: 2.27, formattedCurrent: '90', formattedPrevious: '88' }
      }
    });

    const summary = buildDataDrivenCommentary(data, 'September 2026').executiveSummary;
    expect(summary).toContain('Average ranking position slipped to 15.2');
  });

  it('leaves the narrative lists empty for the agency to author', () => {
    const commentary = buildDataDrivenCommentary(makeData(), 'September 2026');
    expect(commentary.keyWins).toEqual([]);
    expect(commentary.areasForImprovement).toEqual([]);
    expect(commentary.nextMonthPriorities).toEqual([]);
  });

  it('never emits fabricated growth claims', () => {
    const commentary = buildDataDrivenCommentary(makeData(), 'September 2026');
    expect(commentary.executiveSummary).not.toMatch(/solid growth/i);
    expect(commentary.executiveSummary).not.toMatch(/significant improvement/i);
    expect(commentary.executiveSummary).not.toMatch(/captured higher/i);
  });
});