// Unit Tests: KPI & Report Synthesis Engine (executive KPIs, weighted position, rank movements)

import { describe, it, expect } from 'vitest';
import {
  calculateChangePercent,
  calculatePositionChangePercent,
  buildMetric,
  compileReportData
} from '../src/server/services/kpiEngine.js';
import { ParsedCSVDataset, RawGSCQueryRow, RawRankRow } from '../src/types/index.js';

describe('calculateChangePercent', () => {
  it('computes positive growth', () => {
    expect(calculateChangePercent(115, 100)).toBe(15);
  });

  it('computes negative decline', () => {
    expect(calculateChangePercent(80, 100)).toBe(-20);
  });

  it('returns 0 when both previous and current are 0', () => {
    expect(calculateChangePercent(0, 0)).toBe(0);
  });

  it('returns +100% when growing from a zero baseline', () => {
    expect(calculateChangePercent(120, 0)).toBe(100);
    expect(calculateChangePercent(0, 0)).toBe(0);
  });

  it('rounds to exactly 2 decimal places', () => {
    expect(calculateChangePercent(1, 3)).toBe(-66.67);
  });
});

describe('calculatePositionChangePercent (inverted semantics)', () => {
  it('reports a negative change percent when position improves (lower number)', () => {
    // Position moved from 20 to 10 -> better, so changePercent should be negative
    expect(calculatePositionChangePercent(10, 20)).toBe(-50);
  });

  it('reports a positive change percent when position worsens', () => {
    expect(calculatePositionChangePercent(25, 20)).toBe(25);
  });

  it('returns 0 when previous position is 0', () => {
    expect(calculatePositionChangePercent(8, 0)).toBe(0);
  });
});

describe('buildMetric', () => {
  it('produces a formatted metric with change percent', () => {
    const metric = buildMetric(2450, 2000);
    expect(metric.current).toBe(2450);
    expect(metric.previous).toBe(2000);
    expect(metric.changePercent).toBe(22.5);
  });

  it('applies percentage formatting for CTR-like metrics', () => {
    const metric = buildMetric(3.45, 2.8, true);
    expect(metric.formattedCurrent).toBe('3.45%');
    expect(metric.formattedPrevious).toBe('2.80%');
  });
});

describe('compileReportData', () => {
  const queries: RawGSCQueryRow[] = [
    { query: 'a', clicks: 100, impressions: 1000, ctr: 10, position: 2 },
    { query: 'b', clicks: 50, impressions: 500, ctr: 10, position: 4 },
    { query: 'c', clicks: 25, impressions: 250, ctr: 10, position: 6 }
  ];
  const prevQueries: RawGSCQueryRow[] = [
    { query: 'a', clicks: 80, impressions: 900, ctr: 8.89, position: 2.5 },
    { query: 'b', clicks: 60, impressions: 600, ctr: 10, position: 5 },
    { query: 'c', clicks: 10, impressions: 200, ctr: 5, position: 8 }
  ];

  it('computes executive KPI scorecard', () => {
    const data = compileReportData({ gscQueries: queries, previousGscQueries: prevQueries });

    expect(data.kpis.clicks.current).toBe(175);
    expect(data.kpis.clicks.previous).toBe(150);
    // Weighted avg position current: (2*1000 + 4*500 + 6*250)/1750 = (2000+2000+1500)/1750 = 5500/1750 = 3.14
    expect(data.kpis.avgPosition.current).toBeCloseTo(3.1, 1);
  });

  it('sorts top queries by clicks descending', () => {
    const data = compileReportData({ gscQueries: queries });
    expect(data.topQueries[0].query).toBe('a');
    expect(data.topQueries[0].clicks).toBe(100);
  });

  it('is stable when only queries are provided (no pages, GA4, ranks)', () => {
    const data = compileReportData({ gscQueries: queries });
    expect(data.topPages).toEqual([]);
    expect(data.topGainers).toEqual([]);
    expect(data.topLosers).toEqual([]);
    expect(data.channelBreakdown).toEqual([]);
  });

  it('handles negative click on zero baseline without crashing', () => {
    const data = compileReportData({
      gscQueries: queries,
      previousGscQueries: []
    });
    expect(data.kpis.clicks.changePercent).toBe(100);
    expect(data.kpis.impressions.changePercent).toBe(100);
  });
});

describe('compileReportData rank movements', () => {
  it('marks #10 -> #4 as +6 positions gained and sorts as top gainer', () => {
    const rankKeywords: RawRankRow[] = [
      { keyword: 'winner', currentPosition: 4, previousPosition: 10 },
      { keyword: 'loser', currentPosition: 11, previousPosition: 6 },
      { keyword: 'flat', currentPosition: 5, previousPosition: 5 }
    ];

    const data = compileReportData({
      gscQueries: [{ query: 'q', clicks: 1, impressions: 100, ctr: 1, position: 1 }],
      rankKeywords
    });

    expect(data.topGainers).toHaveLength(1);
    expect(data.topGainers[0].keyword).toBe('winner');
    expect(data.topGainers[0].positionChange).toBe(6);
    expect(data.topGainers[0].currentPosition).toBe(4);

    expect(data.topLosers).toHaveLength(1);
    expect(data.topLosers[0].keyword).toBe('loser');
    expect(data.topLosers[0].positionChange).toBe(-5);

    // Flat movement must not appear in either list
    expect(data.topGainers.map(g => g.keyword)).not.toContain('flat');
    expect(data.topLosers.map(l => l.keyword)).not.toContain('flat');
  });

  it('excludes rank rows without previous position from movement lists', () => {
    const rankKeywords: RawRankRow[] = [
      { keyword: 'new-entry', currentPosition: 3 }
    ];

    const data = compileReportData({
      gscQueries: [{ query: 'q', clicks: 1, impressions: 100, ctr: 1, position: 1 }],
      rankKeywords
    });

    expect(data.topGainers).toHaveLength(0);
    expect(data.topLosers).toHaveLength(0);
  });
});

describe('compileReportData GA4 channel breakdown', () => {
  it('aggregates organic sessions and channel list', () => {
    const data = compileReportData({
      gscQueries: [{ query: 'q', clicks: 1, impressions: 100, ctr: 1, position: 1 }],
      ga4Traffic: [
        { channel: 'Organic Search', sessions: 1890, users: 1420, engagementRate: 74.6 },
        { channel: 'Direct', sessions: 680, users: 510, engagementRate: 70.5 }
      ]
    });

    expect(data.kpis.organicSessions.current).toBe(1890);
    expect(data.channelBreakdown).toHaveLength(2);
    expect(data.channelBreakdown![0].engagementRate).toBe(74.6);
  });
});

describe('compileReportData full pipeline', () => {
  it('produces a complete NormalizedReportData shape from a realistic dataset', () => {
    const dataset: ParsedCSVDataset = {
      gscQueries: [
        { query: 'emergency dentist', clicks: 450, impressions: 3200, ctr: 14.06, position: 2.1 },
        { query: 'teeth whitening', clicks: 310, impressions: 4100, ctr: 7.56, position: 3.4 }
      ],
      gscPages: [
        { page: 'https://acme/', clicks: 820, impressions: 9500, ctr: 8.63, position: 2.4 }
      ],
      ga4Traffic: [
        { channel: 'Organic Search', sessions: 1890, users: 1420, engagementRate: 74.6 }
      ],
      rankKeywords: [
        { keyword: 'emergency dentist', currentPosition: 2, previousPosition: 5, searchVolume: 2400 },
        { keyword: 'wisdom tooth', currentPosition: 12, previousPosition: 4, searchVolume: 900 }
      ]
    };

    const data = compileReportData(dataset);

    expect(data.kpis).toBeDefined();
    expect(data.kpis.clicks.current).toBe(760);
    expect(data.kpis.impressions.current).toBe(7300);
    expect(data.topQueries[0].query).toBe('emergency dentist');
    expect(data.topPages[0].page).toBe('https://acme/');
    expect(data.topGainers[0].keyword).toBe('emergency dentist');
    expect(data.topLosers[0].keyword).toBe('wisdom tooth');
    expect(data.channelBreakdown![0].channel).toBe('Organic Search');
  });
});