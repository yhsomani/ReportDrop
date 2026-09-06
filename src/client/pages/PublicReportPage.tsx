// Public Read-Only Client Report View

import React, { useState, useEffect } from 'react';
import { PublicReportResponse } from '../../types/index.js';
import { api } from '../services/api.js';
import {
  Printer,
  Calendar,
  Sparkles,
  TrendingUp,
  TrendingDown,
  MousePointerClick,
  Eye,
  Percent,
  Compass,
  Lock,
  ShieldCheck
} from 'lucide-react';

interface PublicReportPageProps {
  shareToken: string;
}

export const PublicReportPage: React.FC<PublicReportPageProps> = ({ shareToken }) => {
  const [reportData, setReportData] = useState<PublicReportResponse['report'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublic = async () => {
      try {
        setLoading(true);
        const res = await api.getPublicReport(shareToken);
        setReportData(res.report);
      } catch (err: any) {
        console.error('Failed to load public report:', err);
        setError(err?.message || 'Report not found or access is restricted.');
      } finally {
        setLoading(false);
      }
    };
    fetchPublic();
  }, [shareToken]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading client report...</p>
        </div>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Report Not Available</h2>
          <p className="text-xs text-slate-500">
            {error || 'This report may have been set to private or the link token is invalid.'}
          </p>
          <div className="pt-2 text-[11px] text-slate-400">
            If you are the client, please contact your agency partner for an updated link.
          </div>
        </div>
      </div>
    );
  }

  const { reportTitle, reportingPeriod, clientName, clientDomain, data, commentary, branding, createdAt } = reportData;
  const accentColor = branding?.accentColor || '#4F46E5';
  const agencyName = branding?.agencyName || 'Agency Partner';

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      {/* Top Banner (Hidden in Print) */}
      <div className="no-print bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified Client Portal
            </span>
          </div>

          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print to PDF</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print-container">
        {/* Report Header Card */}
        <div
          className="rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${accentColor} 0%, #0f172a 100%)` }}
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{agencyName} SEO Report</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{reportTitle}</h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-white/80 font-medium">
                {clientName && <span>Client: <strong>{clientName}</strong></span>}
                {clientDomain && <span>Domain: <strong className="font-mono">{clientDomain}</strong></span>}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {reportingPeriod}
                </span>
              </div>
            </div>

            {branding?.agencyLogo && (
              <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 self-start md:self-auto">
                <img src={branding.agencyLogo} alt={agencyName} className="h-10 max-w-[140px] object-contain" />
              </div>
            )}
          </div>
        </div>

        {/* Executive Summary & Strategic Review */}
        {commentary && (commentary.executiveSummary || commentary.whatHappened || commentary.whatWeDid || commentary.whatsNext) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6 page-break-inside-avoid">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Executive Summary & Strategic Review</h2>
            </div>

            {commentary.executiveSummary && (
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Performance Overview</h3>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                  {commentary.executiveSummary}
                </p>
              </div>
            )}

            {commentary.whatHappened && (
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Key Highlights & What Happened</h3>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                  {commentary.whatHappened}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              {/* Wins */}
              {commentary.keyWins && commentary.keyWins.length > 0 && (
                <div className="space-y-2 p-4 bg-emerald-50/40 rounded-xl border border-emerald-100">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Key Wins & Highlights
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {commentary.keyWins.map((win: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span className="text-slate-600">{win}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Opportunities */}
              {commentary.areasForImprovement && commentary.areasForImprovement.length > 0 && (
                <div className="space-y-2 p-4 bg-amber-50/40 rounded-xl border border-amber-100">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-amber-600" /> Focus Opportunities
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {commentary.areasForImprovement.map((area: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span className="text-slate-600">{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Month */}
              {commentary.nextMonthPriorities && commentary.nextMonthPriorities.length > 0 && (
                <div className="space-y-2 p-4 bg-indigo-50/40 rounded-xl border border-indigo-100">
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-indigo-600" /> Next Month Strategy
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {commentary.nextMonthPriorities.map((pri: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-indigo-500 font-bold">•</span>
                        <span className="text-slate-600">{pri}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Executive KPI Scorecard Grid */}
        {data?.kpis && (
          <div className="space-y-3 page-break-inside-avoid">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Search Performance KPIs</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Total Clicks */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Total Clicks</span>
                  <MousePointerClick className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                  {data.kpis.clicks.current.toLocaleString()}
                </div>
                {data.kpis.clicks.changePercent !== 0 && (
                  <div className={`text-[11px] font-bold mt-1.5 flex items-center gap-1 ${
                    data.kpis.clicks.changePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {data.kpis.clicks.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{data.kpis.clicks.changePercent >= 0 ? '+' : ''}{data.kpis.clicks.changePercent.toFixed(1)}% MoM</span>
                  </div>
                )}
              </div>

              {/* Total Impressions */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Impressions</span>
                  <Eye className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                  {data.kpis.impressions.current.toLocaleString()}
                </div>
                {data.kpis.impressions.changePercent !== 0 && (
                  <div className={`text-[11px] font-bold mt-1.5 flex items-center gap-1 ${
                    data.kpis.impressions.changePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {data.kpis.impressions.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{data.kpis.impressions.changePercent >= 0 ? '+' : ''}{data.kpis.impressions.changePercent.toFixed(1)}% MoM</span>
                  </div>
                )}
              </div>

              {/* Average CTR */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Avg CTR</span>
                  <Percent className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                  {data.kpis.ctr.current.toFixed(2)}%
                </div>
                {data.kpis.ctr.changePercent !== 0 && (
                  <div className={`text-[11px] font-bold mt-1.5 flex items-center gap-1 ${
                    data.kpis.ctr.changePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {data.kpis.ctr.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{data.kpis.ctr.changePercent >= 0 ? '+' : ''}{data.kpis.ctr.changePercent.toFixed(2)}% MoM</span>
                  </div>
                )}
              </div>

              {/* Average Position */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Avg Position</span>
                  <Compass className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                  {data.kpis.avgPosition.current.toFixed(1)}
                </div>
                {data.kpis.avgPosition.changePercent !== 0 && (
                  <div className={`text-[11px] font-bold mt-1.5 flex items-center gap-1 ${
                    data.kpis.avgPosition.changePercent <= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {data.kpis.avgPosition.changePercent <= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{data.kpis.avgPosition.changePercent <= 0 ? '+' : ''}{Math.abs(data.kpis.avgPosition.changePercent).toFixed(1)}% Pos.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top Search Queries Table */}
        {data?.topQueries && data.topQueries.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs page-break-inside-avoid">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Top Organic Search Queries</h3>
                <p className="text-[11px] text-slate-400">Search terms driving user intent & traffic</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Search Query</th>
                    <th className="px-6 py-3 text-right">Clicks</th>
                    <th className="px-6 py-3 text-right">Impressions</th>
                    <th className="px-6 py-3 text-right">CTR</th>
                    <th className="px-6 py-3 text-right">Avg. Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.topQueries.slice(0, 15).map((q, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="px-6 py-3 font-semibold text-slate-800 max-w-xs truncate">{q.query}</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-900">{q.clicks.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right text-slate-600">{q.impressions.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right font-mono text-slate-700">{q.ctr.toFixed(2)}%</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                          q.position <= 3
                            ? 'bg-emerald-50 text-emerald-700'
                            : q.position <= 10
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          #{q.position.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Landing Pages Table */}
        {data?.topPages && data.topPages.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs page-break-inside-avoid">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Top Landing Pages</h3>
                <p className="text-[11px] text-slate-400">High-converting entrance URLs from organic search</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Page URL</th>
                    <th className="px-6 py-3 text-right">Clicks</th>
                    <th className="px-6 py-3 text-right">Impressions</th>
                    <th className="px-6 py-3 text-right">CTR</th>
                    <th className="px-6 py-3 text-right">Avg. Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.topPages.slice(0, 10).map((p, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="px-6 py-3 font-mono text-slate-800 max-w-sm truncate">{p.page}</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-900">{p.clicks.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right text-slate-600">{p.impressions.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right font-mono text-slate-700">{p.ctr.toFixed(2)}%</td>
                      <td className="px-6 py-3 text-right font-mono text-slate-600">#{p.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Gainers & Losers */}
        {((data?.topGainers && data.topGainers.length > 0) || (data?.topLosers && data.topLosers.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 page-break-inside-avoid">
            {/* Top Gainers */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Top Keyword Rank Gainers</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3">Keyword</th>
                      <th className="px-6 py-3 text-right">Rank</th>
                      <th className="px-6 py-3 text-right">Gain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topGainers.map((k, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="px-6 py-3 font-semibold text-slate-800 truncate max-w-xs">{k.keyword}</td>
                        <td className="px-6 py-3 text-right font-bold text-slate-900">#{k.currentPosition}</td>
                        <td className="px-6 py-3 text-right text-emerald-600 font-bold">+{k.positionChange}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Losers */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">Top Keyword Rank Drops</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3">Keyword</th>
                      <th className="px-6 py-3 text-right">Rank</th>
                      <th className="px-6 py-3 text-right">Decline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topLosers.map((k, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="px-6 py-3 font-semibold text-slate-800 truncate max-w-xs">{k.keyword}</td>
                        <td className="px-6 py-3 text-right font-bold text-slate-900">#{k.currentPosition}</td>
                        <td className="px-6 py-3 text-right text-rose-600 font-bold">{k.positionChange}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* GA4 Channel Breakdown */}
        {data?.channelBreakdown && data.channelBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs page-break-inside-avoid">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Traffic Acquisition Channels</h3>
                <p className="text-[11px] text-slate-400">GA4 default channel grouping performance</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Channel Group</th>
                    <th className="px-6 py-3 text-right">Sessions</th>
                    <th className="px-6 py-3 text-right">Active Users</th>
                    <th className="px-6 py-3 text-right">Engagement Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.channelBreakdown.map((c, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="px-6 py-3 font-semibold text-slate-800">{c.channel}</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-900">{c.sessions.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right text-slate-600">{c.users.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right font-mono text-slate-700">{c.engagementRate.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-400 page-break-inside-avoid">
          <div>
            Prepared on {new Date(createdAt).toLocaleDateString()} by <span className="font-semibold text-slate-700">{agencyName}</span>
          </div>
          {branding?.showWatermark ? (
            <div className="flex items-center gap-1 text-[11px]">
              <span>Powered by</span>
              <span className="font-bold text-indigo-600">ReportDrop</span>
            </div>
          ) : (
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              {agencyName} Confidential Client Report
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
