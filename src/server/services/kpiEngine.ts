// KPI Calculation & Report Synthesis Engine

import {
  ParsedCSVDataset,
  NormalizedReportData,
  KPIScorecard,
  MetricWithComparison,
  TopQuery,
  TopPage,
  KeywordMovement
} from '../../types/index.js';

/**
 * Calculates percentage change safely.
 * Returns 0 if previous and current are 0.
 * If previous is 0 and current > 0, returns +100.0%.
 */
export function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return current > 0 ? 100 : -100;
  }
  const delta = current - previous;
  const pct = (delta / Math.abs(previous)) * 100;
  return Number(pct.toFixed(2));
}

/**
 * Calculates position change percentage.
 * In SEO, a lower rank number is better (e.g. #1 is best).
 * If position drops from 20 to 10, it's an improvement (-50% in position number, or +10 ranks).
 */
export function calculatePositionChangePercent(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 0 : 0;
  }
  // Negative percent change in position value means improvement
  const delta = current - previous;
  const pct = (delta / previous) * 100;
  return Number(pct.toFixed(2));
}

export function buildMetric(current: number, previous: number, formatAsPercent = false): MetricWithComparison {
  const changePercent = calculateChangePercent(current, previous);
  const formattedCurrent = formatAsPercent
    ? `${current.toFixed(2)}%`
    : current >= 1000 ? current.toLocaleString() : current.toString();
  const formattedPrevious = formatAsPercent
    ? `${previous.toFixed(2)}%`
    : previous >= 1000 ? previous.toLocaleString() : previous.toString();

  return {
    current,
    previous,
    changePercent,
    formattedCurrent,
    formattedPrevious
  };
}

export function compileReportData(dataset: ParsedCSVDataset): NormalizedReportData {
  // 1. Process GSC Queries
  const currentQueries = dataset.gscQueries || [];
  const prevQueries = dataset.previousGscQueries || [];

  const totalClicksCurrent = currentQueries.reduce((sum, q) => sum + q.clicks, 0);
  const totalImprCurrent = currentQueries.reduce((sum, q) => sum + q.impressions, 0);
  const avgCtrCurrent = totalImprCurrent > 0 ? (totalClicksCurrent / totalImprCurrent) * 100 : 0;

  const weightedPositionSum = currentQueries.reduce((sum, q) => sum + (q.position * (q.impressions || 1)), 0);
  const totalImprForPos = currentQueries.reduce((sum, q) => sum + (q.impressions || 1), 0);
  const avgPositionCurrent = totalImprForPos > 0 ? weightedPositionSum / totalImprForPos : 0;

  // Previous GSC Queries (if provided)
  const totalClicksPrev = prevQueries.reduce((sum, q) => sum + q.clicks, 0);
  const totalImprPrev = prevQueries.reduce((sum, q) => sum + q.impressions, 0);
  const avgCtrPrev = totalImprPrev > 0 ? (totalClicksPrev / totalImprPrev) * 100 : 0;
  const prevWeightedPosSum = prevQueries.reduce((sum, q) => sum + (q.position * (q.impressions || 1)), 0);
  const prevTotalImprForPos = prevQueries.reduce((sum, q) => sum + (q.impressions || 1), 0);
  const avgPositionPrev = prevTotalImprForPos > 0 ? prevWeightedPosSum / prevTotalImprForPos : 0;

  // 2. Process GA4 Organic Traffic
  const currentGa4 = dataset.ga4Traffic || [];
  const prevGa4 = dataset.previousGa4Traffic || [];

  // Filter or aggregate organic sessions
  const organicChannels = ['organic search', 'organic', 'search'];
  const isOrganic = (ch: string) => organicChannels.some(o => ch.toLowerCase().includes(o));

  const organicSessionsCurrent = currentGa4
    .filter(row => isOrganic(row.channel))
    .reduce((sum, row) => sum + row.sessions, 0) || currentGa4.reduce((sum, row) => sum + row.sessions, 0);

  const organicSessionsPrev = prevGa4
    .filter(row => isOrganic(row.channel))
    .reduce((sum, row) => sum + row.sessions, 0) || prevGa4.reduce((sum, row) => sum + row.sessions, 0);

  // 3. Build KPI Scorecard
  const kpis: KPIScorecard = {
    clicks: buildMetric(totalClicksCurrent, totalClicksPrev),
    impressions: buildMetric(totalImprCurrent, totalImprPrev),
    ctr: buildMetric(Number(avgCtrCurrent.toFixed(2)), Number(avgCtrPrev.toFixed(2)), true),
    avgPosition: {
      current: Number(avgPositionCurrent.toFixed(1)),
      previous: Number(avgPositionPrev.toFixed(1)),
      changePercent: calculatePositionChangePercent(avgPositionCurrent, avgPositionPrev),
      formattedCurrent: avgPositionCurrent.toFixed(1),
      formattedPrevious: avgPositionPrev.toFixed(1)
    },
    organicSessions: buildMetric(organicSessionsCurrent, organicSessionsPrev)
  };

  // 4. Extract Top Queries (Sorted by clicks desc, then impressions desc)
  const topQueries: TopQuery[] = [...currentQueries]
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 10)
    .map(q => ({
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      position: q.position
    }));

  // 5. Extract Top Pages
  const topPages: TopPage[] = [...(dataset.gscPages || [])]
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 10)
    .map(p => ({
      page: p.page,
      clicks: p.clicks,
      impressions: p.impressions,
      ctr: p.ctr,
      position: p.position
    }));

  // 6. Calculate Rank Movement (Gainers & Losers)
  const rankKeywords = dataset.rankKeywords || [];
  const movements: KeywordMovement[] = [];

  for (const r of rankKeywords) {
    if (r.previousPosition !== undefined && r.previousPosition > 0 && r.currentPosition > 0) {
      // In rankings, moving from #10 to #4 means +6 positions gained
      const positionChange = r.previousPosition - r.currentPosition;
      movements.push({
        keyword: r.keyword,
        currentPosition: r.currentPosition,
        previousPosition: r.previousPosition,
        positionChange,
        searchVolume: r.searchVolume,
        url: r.url
      });
    }
  }

  // Gainers: largest positive position improvement
  const topGainers = movements
    .filter(m => m.positionChange > 0)
    .sort((a, b) => b.positionChange - a.positionChange)
    .slice(0, 8);

  // Losers: largest negative position decline
  const topLosers = movements
    .filter(m => m.positionChange < 0)
    .sort((a, b) => a.positionChange - b.positionChange)
    .slice(0, 8);

  // 7. Channel breakdown from GA4
  const channelBreakdown = currentGa4.map(g => ({
    channel: g.channel,
    sessions: g.sessions,
    users: g.users,
    engagementRate: g.engagementRate ?? 0
  }));

  return {
    kpis,
    topQueries,
    topPages,
    topGainers,
    topLosers,
    channelBreakdown
  };
}
