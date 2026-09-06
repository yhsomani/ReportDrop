// ReportDrop Core Type Definitions

export type PlanTier = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'inactive' | 'past_due';

export interface User {
  id: string;
  email: string;
  fullName: string;
  agencyName: string;
  agencyLogo?: string;
  accentColor?: string;
  plan: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  id: string;
  userId: string;
  clientName: string;
  clientDomain: string;
  currency: string;
  reportCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface MetricWithComparison {
  current: number;
  previous: number;
  changePercent: number; // e.g., +15.5 or -8.2
  formattedCurrent?: string;
  formattedPrevious?: string;
}

export interface KPIScorecard {
  clicks: MetricWithComparison;
  impressions: MetricWithComparison;
  ctr: MetricWithComparison; // In percent e.g. 3.45%
  avgPosition: MetricWithComparison; // Note: lower number = better rank
  organicSessions: MetricWithComparison;
}

export interface TopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface TopPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface KeywordMovement {
  keyword: string;
  currentPosition: number;
  previousPosition: number;
  positionChange: number; // positive = gained ranks (e.g. from pos 10 to 4 is +6)
  searchVolume?: number;
  url?: string;
}

export interface NormalizedReportData {
  kpis: KPIScorecard;
  topQueries: TopQuery[];
  topPages: TopPage[];
  topGainers: KeywordMovement[];
  topLosers: KeywordMovement[];
  channelBreakdown?: {
    channel: string;
    sessions: number;
    users: number;
    engagementRate: number;
  }[];
}

export interface ReportCommentary {
  whatHappened?: string;
  whatWeDid?: string;
  whatsNext?: string;
  executiveSummary?: string;
  keyWins?: string[];
  areasForImprovement?: string[];
  nextMonthPriorities?: string[];
}

export interface ReportBranding {
  agencyName: string;
  agencyLogo?: string;
  accentColor: string;
  showWatermark?: boolean;
}

export interface Report {
  id: string;
  workspaceId: string;
  userId: string;
  reportTitle: string;
  reportingPeriod: string;
  shareToken: string;
  isPublic: boolean;
  data: NormalizedReportData;
  commentary: ReportCommentary;
  branding: ReportBranding;
  status: 'draft' | 'published';
  createdAt: number;
  updatedAt: number;
}

export interface PublicReportView {
  reportTitle: string;
  reportingPeriod: string;
  data: NormalizedReportData;
  commentary: ReportCommentary;
  branding: ReportBranding;
  clientName?: string;
  clientDomain?: string;
  createdAt: number;
}

export interface PublicReportResponse {
  report: {
    id?: string;
    reportTitle: string;
    reportingPeriod: string;
    clientName?: string;
    clientDomain?: string;
    data: NormalizedReportData;
    commentary: ReportCommentary;
    branding: ReportBranding;
    createdAt: number;
  };
}

export interface RawGSCQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface RawGSCPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface RawGA4TrafficRow {
  channel: string;
  sessions: number;
  users: number;
  engagementRate?: number;
}

export interface RawRankRow {
  keyword: string;
  currentPosition: number;
  previousPosition?: number;
  searchVolume?: number;
  url?: string;
}

export interface ParsedCSVDataset {
  gscQueries?: RawGSCQueryRow[];
  gscPages?: RawGSCPageRow[];
  ga4Traffic?: RawGA4TrafficRow[];
  rankKeywords?: RawRankRow[];
  previousGscQueries?: RawGSCQueryRow[];
  previousGa4Traffic?: RawGA4TrafficRow[];
}
