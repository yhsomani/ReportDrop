// Unit Tests: Data Normalization Layer (GSC Queries, GSC Pages, GA4 Traffic, Rank Trackers)

import { describe, it, expect } from 'vitest';
import {
  parseCleanNumber,
  parseCleanCTR,
  normalizeGSCQueries,
  normalizeGSCPages,
  normalizeGA4Traffic,
  normalizeRankKeywords
} from '../src/server/services/normalizer.js';

describe('parseCleanNumber', () => {
  it('parses numbers with commas and % signs', () => {
    expect(parseCleanNumber('1,234')).toBe(1234);
    expect(parseCleanNumber('12.5%')).toBe(12.5);
    expect(parseCleanNumber('$499')).toBe(499);
  });

  it('returns 0 for nullish or unparseable input', () => {
    expect(parseCleanNumber(null)).toBe(0);
    expect(parseCleanNumber(undefined)).toBe(0);
    expect(parseCleanNumber('abc')).toBe(0);
    expect(parseCleanNumber('')).toBe(0);
  });

  it('passes through numeric input', () => {
    expect(parseCleanNumber(42)).toBe(42);
    expect(parseCleanNumber(NaN)).toBe(0);
  });
});

describe('parseCleanCTR', () => {
  it('parses percent strings', () => {
    expect(parseCleanCTR('14.06%')).toBe(14.06);
  });

  it('converts fractional probabilities to percent', () => {
    expect(parseCleanCTR('0.035')).toBe(3.5);
  });

  it('keeps numeric percentages as-is', () => {
    expect(parseCleanCTR('8.63')).toBe(8.63);
  });

  it('handles empty / invalid values', () => {
    expect(parseCleanCTR('')).toBe(0);
    expect(parseCleanCTR(null)).toBe(0);
  });
});

describe('normalizeGSCQueries', () => {
  it('normalizes standard GSC Queries export', () => {
    const csv = `Top queries,Clicks,Impressions,CTR,Position
emergency dentist,450,3200,14.06%,2.1`;

    const rows = normalizeGSCQueries(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].query).toBe('emergency dentist');
    expect(rows[0].clicks).toBe(450);
    expect(rows[0].impressions).toBe(3200);
    expect(rows[0].ctr).toBeCloseTo(14.06, 2);
    expect(rows[0].position).toBe(2.1);
  });

  it('matches a wide variety of header spellings', () => {
    const csv = `Keyword,Total clicks,Total impressions,Average CTR,Rank
root canal,190,5200,3.65,4.2`;

    const rows = normalizeGSCQueries(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].query).toBe('root canal');
    expect(rows[0].clicks).toBe(190);
    expect(rows[0].position).toBe(4.2);
  });

  it('auto-computes CTR from clicks/impressions when missing', () => {
    const csv = `Top queries,Clicks,Impressions,Position
teeth whitening,310,4100,3.4`;

    const rows = normalizeGSCQueries(csv);
    expect(rows[0].ctr).toBeCloseTo((310 / 4100) * 100, 2);
  });

  it('skips rows without a query', () => {
    const csv = `Top queries,Clicks,Impressions
,100,200
hello,50,100`;
    const rows = normalizeGSCQueries(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].query).toBe('hello');
  });
});

describe('normalizeGSCPages', () => {
  it('normalizes page URLs with correct field mapping', () => {
    const csv = `Top pages,Clicks,Impressions,CTR,Position
https://acmedental.com/,820,9500,8.63%,2.4`;

    const rows = normalizeGSCPages(csv);
    expect(rows[0].page).toBe('https://acmedental.com/');
    expect(rows[0].clicks).toBe(820);
    expect(rows[0].ctr).toBeCloseTo(8.63, 2);
  });

  it('matches URL / landing page headers', () => {
    const csv = `Landing page,Clicks,Impressions
https://acmedental.com/services,100,400`;
    const rows = normalizeGSCPages(csv);
    expect(rows[0].page).toBe('https://acmedental.com/services');
  });
});

describe('normalizeGA4Traffic', () => {
  it('normalizes GA4 traffic acquisition export', () => {
    const csv = `Session default channel group,Users,Sessions,Engagement rate
Organic Search,1420,1890,74.6%
Direct,510,680,70.5%`;

    const rows = normalizeGA4Traffic(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].channel).toBe('Organic Search');
    expect(rows[0].sessions).toBe(1890);
    expect(rows[0].users).toBe(1420);
    expect(rows[0].engagementRate).toBeCloseTo(74.6, 1);
  });

  it('normalizes source / medium granular rows', () => {
    const csv = `Source / medium,Sessions
google / organic,1500
facebook.com / social,88`;
    const rows = normalizeGA4Traffic(csv);
    expect(rows[0].channel).toBe('google / organic');
    expect(rows[0].sessions).toBe(1500);
  });
});

describe('normalizeRankKeywords', () => {
  it('normalizes rank tracker export with gain/loss positions', () => {
    const csv = `Keyword,Current Position,Previous Position,Search Volume,URL
emergency dentist,2,5,2400,https://acmedental.com/services/emergency`;

    const rows = normalizeRankKeywords(csv);
    expect(rows[0].keyword).toBe('emergency dentist');
    expect(rows[0].currentPosition).toBe(2);
    expect(rows[0].previousPosition).toBe(5);
    expect(rows[0].searchVolume).toBe(2400);
    expect(rows[0].url).toBe('https://acmedental.com/services/emergency');
  });

  it('tolerates missing previous position and volume', () => {
    const csv = `Keyword,Position
new keyword,7`;
    const rows = normalizeRankKeywords(csv);
    expect(rows[0].currentPosition).toBe(7);
    expect(rows[0].previousPosition).toBeUndefined();
    expect(rows[0].searchVolume).toBeUndefined();
  });

  it('drops keywords with invalid (zero) positions', () => {
    const csv = `Keyword,Position
never ranked,0
extra,garbage`;
    const rows = normalizeRankKeywords(csv);
    expect(rows).toHaveLength(0);
  });
});