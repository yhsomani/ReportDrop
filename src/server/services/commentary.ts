// Data-Driven Report Commentary Engine.
//
// Builds a factual executive summary from the measured KPI values — never from
// invented claims. Only deltas that were computable (previous-period data was
// actually provided) are reported with change figures; otherwise the summary
// explicitly states that no previous-period data was provided. The
// win / improvement / priority lists are deliberately left empty so the agency
// writes its own narrative in the report editor rather than shipping a canned
// one that misrepresents real numbers.

import { NormalizedReportData, ReportCommentary } from '../../types/index.js';

/** True only when a previous-period CSV was actually supplied. A prior period
 *  measured as exactly zero for every KPI is indistinguishable from an absent
 *  one, so the summary falls back to the honest "no previous-period data". */
function hasPreviousPeriod(data: NormalizedReportData): boolean {
  const { kpis } = data;
  return (
    kpis.clicks.previous > 0 ||
    kpis.impressions.previous > 0 ||
    kpis.organicSessions.previous > 0
  );
}

function fmt(n: number): string {
  if (!isFinite(n)) return '0';
  return n >= 1000 ? n.toLocaleString('en-IN') : n.toString();
}

function arrow(n: number): string {
  return n > 0 ? '↑' : n < 0 ? '↓' : '→';
}

function pct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${Number(n).toFixed(1)}%`;
}

/**
 * Produces a factual executive summary and an empty narrative scaffold for the
 * agency to complete. Pure and deterministic — unit-tested.
 */
export function buildDataDrivenCommentary(
  data: NormalizedReportData,
  period: string
): ReportCommentary {
  const { kpis } = data;
  const hasPrev = hasPreviousPeriod(data);

  const parts: string[] = [];
  parts.push(`Organic search delivered ${fmt(kpis.clicks.current)} clicks and ${fmt(kpis.impressions.current)} impressions during ${period}.`);

  if (!hasPrev) {
    parts.push(
      'Click-through rate was ' +
        `${Number(kpis.ctr.current).toFixed(2)}%, average ranking position ${Number(kpis.avgPosition.current).toFixed(1)}, ` +
        `and organic sessions reached ${fmt(kpis.organicSessions.current)}. ` +
        'No previous-period data was provided, so month-over-month changes could not be measured.'
    );
  } else {
    const ct = [
      `clicks ${arrow(kpis.clicks.changePercent)} ${pct(kpis.clicks.changePercent)}`,
      `impressions ${arrow(kpis.impressions.changePercent)} ${pct(kpis.impressions.changePercent)}`,
      `CTR ${arrow(kpis.ctr.changePercent)} ${pct(kpis.ctr.changePercent)}`
    ];
    parts.push(`Month-over-month: ${ct.join(', ')}.`);

    if (kpis.avgPosition.changePercent < -0.05) {
      parts.push(`Average ranking position improved to ${Number(kpis.avgPosition.current).toFixed(1)} (${arrow(kpis.avgPosition.changePercent)} ${Math.abs(kpis.avgPosition.changePercent).toFixed(1)}% in position value).`);
    } else if (kpis.avgPosition.changePercent > 0.05) {
      parts.push(`Average ranking position slipped to ${Number(kpis.avgPosition.current).toFixed(1)} (${arrow(kpis.avgPosition.changePercent)} ${Math.abs(kpis.avgPosition.changePercent).toFixed(1)}% in position value).`);
    } else {
      parts.push(`Average ranking position held steady at ${Number(kpis.avgPosition.current).toFixed(1)}.`);
    }

    parts.push(`Organic sessions ${arrow(kpis.organicSessions.changePercent)} ${pct(kpis.organicSessions.changePercent)} to ${fmt(kpis.organicSessions.current)}.`);
  }

  return {
    executiveSummary: parts.join(' '),
    keyWins: [],
    areasForImprovement: [],
    nextMonthPriorities: []
  };
}