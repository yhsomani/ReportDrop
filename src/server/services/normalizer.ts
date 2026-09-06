// Data Normalization Layer for GSC, GA4, and Rank Tracker CSV exports

import {
  RawGSCQueryRow,
  RawGSCPageRow,
  RawGA4TrafficRow,
  RawRankRow
} from '../../types/index.js';
import { parseCSVToObjects } from './csvParser.js';

// Helper to parse numbers safely with % and comma handling
export function parseCleanNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).replace(/['"%$,\s]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function parseCleanCTR(val: any): number {
  if (val === null || val === undefined) return 0;
  const str = String(val).replace(/['"]/g, '').trim();
  if (str.endsWith('%')) {
    return parseCleanNumber(str.slice(0, -1));
  }
  const num = parseCleanNumber(str);
  // If CTR is given as a fraction like 0.035, convert to percent 3.5%
  if (num > 0 && num <= 1) {
    return Number((num * 100).toFixed(2));
  }
  return Number(num.toFixed(2));
}

// Find object key case-insensitively
function findKey(obj: Record<string, string>, candidates: string[]): string | undefined {
  const keys = Object.keys(obj);
  for (const candidate of candidates) {
    const found = keys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
    if (found) return found;
  }
  return undefined;
}

/**
 * Normalizes Google Search Console Queries Export.
 * Matches common column variations: Top queries / Query, Clicks, Impressions, CTR, Position.
 */
export function normalizeGSCQueries(csvText: string): RawGSCQueryRow[] {
  const objects = parseCSVToObjects(csvText);
  const normalized: RawGSCQueryRow[] = [];

  for (const row of objects) {
    const queryKey = findKey(row, ['top queries', 'query', 'queries', 'keyword', 'search query']);
    if (!queryKey) continue;

    const query = row[queryKey]?.trim();
    if (!query) continue;

    const clicksKey = findKey(row, ['clicks', 'total clicks', 'click']);
    const impressionsKey = findKey(row, ['impressions', 'total impressions', 'impr']);
    const ctrKey = findKey(row, ['ctr', 'click through rate', 'average ctr']);
    const positionKey = findKey(row, ['position', 'avg position', 'average position', 'rank']);

    const clicks = clicksKey ? parseCleanNumber(row[clicksKey]) : 0;
    const impressions = impressionsKey ? parseCleanNumber(row[impressionsKey]) : 0;
    let ctr = ctrKey ? parseCleanCTR(row[ctrKey]) : 0;

    // Calculate CTR if missing or 0 but clicks & impressions exist
    if (ctr === 0 && impressions > 0 && clicks > 0) {
      ctr = Number(((clicks / impressions) * 100).toFixed(2));
    }

    const position = positionKey ? parseCleanNumber(row[positionKey]) : 0;

    normalized.push({
      query,
      clicks,
      impressions,
      ctr,
      position: Number(position.toFixed(1))
    });
  }

  return normalized;
}

/**
 * Normalizes Google Search Console Pages Export.
 */
export function normalizeGSCPages(csvText: string): RawGSCPageRow[] {
  const objects = parseCSVToObjects(csvText);
  const normalized: RawGSCPageRow[] = [];

  for (const row of objects) {
    const pageKey = findKey(row, ['top pages', 'page', 'pages', 'url', 'landing page']);
    if (!pageKey) continue;

    const page = row[pageKey]?.trim();
    if (!page) continue;

    const clicksKey = findKey(row, ['clicks', 'total clicks', 'click']);
    const impressionsKey = findKey(row, ['impressions', 'total impressions', 'impr']);
    const ctrKey = findKey(row, ['ctr', 'click through rate', 'average ctr']);
    const positionKey = findKey(row, ['position', 'avg position', 'average position', 'rank']);

    const clicks = clicksKey ? parseCleanNumber(row[clicksKey]) : 0;
    const impressions = impressionsKey ? parseCleanNumber(row[impressionsKey]) : 0;
    let ctr = ctrKey ? parseCleanCTR(row[ctrKey]) : 0;

    if (ctr === 0 && impressions > 0 && clicks > 0) {
      ctr = Number(((clicks / impressions) * 100).toFixed(2));
    }

    const position = positionKey ? parseCleanNumber(row[positionKey]) : 0;

    normalized.push({
      page,
      clicks,
      impressions,
      ctr,
      position: Number(position.toFixed(1))
    });
  }

  return normalized;
}

/**
 * Normalizes Google Analytics 4 Traffic Acquisition Export.
 */
export function normalizeGA4Traffic(csvText: string): RawGA4TrafficRow[] {
  const objects = parseCSVToObjects(csvText);
  const normalized: RawGA4TrafficRow[] = [];

  for (const row of objects) {
    const channelKey = findKey(row, [
      'session default channel group',
      'channel group',
      'channel',
      'default channel grouping',
      'source / medium',
      'source'
    ]);
    if (!channelKey) continue;

    const channel = row[channelKey]?.trim();
    if (!channel) continue;

    const sessionsKey = findKey(row, ['sessions', 'total sessions', 'session count']);
    const usersKey = findKey(row, ['users', 'total users', 'active users']);
    const engagementKey = findKey(row, ['engagement rate', 'bounce rate', 'engagement']);

    const sessions = sessionsKey ? parseCleanNumber(row[sessionsKey]) : 0;
    const users = usersKey ? parseCleanNumber(row[usersKey]) : 0;
    const engagementRate = engagementKey ? parseCleanCTR(row[engagementKey]) : undefined;

    normalized.push({
      channel,
      sessions,
      users,
      engagementRate
    });
  }

  return normalized;
}

/**
 * Normalizes Keyword Rank Tracker Export (SEMrush, Ahrefs, SE Ranking, etc.).
 */
export function normalizeRankKeywords(csvText: string): RawRankRow[] {
  const objects = parseCSVToObjects(csvText);
  const normalized: RawRankRow[] = [];

  for (const row of objects) {
    const keywordKey = findKey(row, ['keyword', 'query', 'search term', 'phrase', 'target keyword']);
    if (!keywordKey) continue;

    const keyword = row[keywordKey]?.trim();
    if (!keyword) continue;

    const currentPosKey = findKey(row, ['current position', 'position', 'rank', 'current rank', 'pos']);
    const prevPosKey = findKey(row, ['previous position', 'prev position', 'previous rank', 'prev rank', 'pos (prev)']);
    const volKey = findKey(row, ['search volume', 'volume', 'sv']);
    const urlKey = findKey(row, ['url', 'landing page', 'ranking url']);

    const currentPosition = currentPosKey ? parseCleanNumber(row[currentPosKey]) : 0;
    const previousPosition = prevPosKey ? parseCleanNumber(row[prevPosKey]) : undefined;
    const searchVolume = volKey ? parseCleanNumber(row[volKey]) : undefined;
    const url = urlKey ? row[urlKey]?.trim() : undefined;

    if (currentPosition > 0) {
      normalized.push({
        keyword,
        currentPosition,
        previousPosition,
        searchVolume,
        url
      });
    }
  }

  return normalized;
}
