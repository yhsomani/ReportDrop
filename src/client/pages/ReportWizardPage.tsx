// Multi-Step CSV Dropzone & Compiler Wizard

import React, { useState, useEffect } from 'react';
import { Workspace, NormalizedReportData } from '../../types/index.js';
import { buildDataDrivenCommentary } from '../../server/services/commentary.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Building2,
  X
} from 'lucide-react';

interface ReportWizardPageProps {
  onCancel: () => void;
  onReportCreated: (reportId: string) => void;
}

// Sample CSV payloads for fast onboarding & demo — dev-only. The constants are
// only ever referenced by the dev-gated loader below, so they are tree-shaken
// out of production bundles; real users upload their own GSC/GA4 exports.
const SAMPLE_GSC_QUERIES = `Top queries,Clicks,Impressions,CTR,Position
emergency dentist near me,450,3200,14.06%,2.1
teeth whitening cost,310,4100,7.56%,3.4
dental implants specialist,280,2900,9.66%,1.8
root canal symptoms,190,5200,3.65%,4.2
pediatric dentist open saturday,160,1800,8.89%,2.9
invisalign vs braces,140,3100,4.52%,5.1
best cosmetic dentist,125,2400,5.21%,3.7
wisdom tooth pain relief,110,4800,2.29%,6.8
dental crown procedure,95,1900,5.00%,4.5
affordable dental care,85,2100,4.05%,5.9`;

const SAMPLE_GSC_PAGES = `Top pages,Clicks,Impressions,CTR,Position
https://acmedental.com/,820,9500,8.63%,2.4
https://acmedental.com/services/emergency,410,2800,14.64%,1.9
https://acmedental.com/services/implants,290,2600,11.15%,2.1
https://acmedental.com/services/whitening,240,3100,7.74%,3.2
https://acmedental.com/blog/wisdom-tooth-care,180,4200,4.29%,5.4`;

const SAMPLE_GA4 = `Session default channel group,Users,Sessions,Engaged sessions,Engagement rate,Key events,Event count
Organic Search,1420,1890,1410,74.6%,84,9520
Direct,510,680,480,70.5%,28,2410
Referral,290,360,250,69.4%,19,1650
Organic Social,180,220,140,63.6%,8,890`;

const SAMPLE_PREVIOUS_GSC_QUERIES = `Top queries,Clicks,Impressions,CTR,Position
emergency dentist near me,380,2800,13.57%,2.5
teeth whitening cost,270,3600,7.50%,3.8
dental implants specialist,240,2500,9.60%,2.2
root canal symptoms,170,4800,3.54%,4.5
pediatric dentist open saturday,140,1600,8.75%,3.2
invisalign vs braces,120,2900,4.14%,5.4
best cosmetic dentist,110,2200,5.00%,4.0
wisdom tooth pain relief,95,4200,2.26%,7.1
dental crown procedure,80,1700,4.71%,4.8
affordable dental care,70,1900,3.68%,6.3`;

const SAMPLE_PREVIOUS_GA4 = `Session default channel group,Users,Sessions,Engaged sessions,Engagement rate,Key events,Event count
Organic Search,1210,1580,1160,73.4%,70,7800
Direct,460,590,410,69.5%,22,2100
Referral,250,310,210,67.7%,15,1400
Organic Social,150,180,110,61.1%,6,720`;

const SAMPLE_RANK = `Keyword,Current Position,Previous Position,Search Volume,URL
emergency dentist,2,5,2400,https://acmedental.com/services/emergency
dental implants specialist,1,3,1900,https://acmedental.com/services/implants
teeth whitening clinic,3,7,3200,https://acmedental.com/services/whitening
invisalign provider,5,4,1600,https://acmedental.com/services/invisalign
pediatric dentistry,3,8,1300,https://acmedental.com/services/pediatric`;

export const ReportWizardPage: React.FC<ReportWizardPageProps> = ({ onCancel, onReportCreated }) => {
  const { user, refreshUser } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [reportTitle, setReportTitle] = useState<string>('');

  // Current month by default, so reports always label the real reporting window.
  const [reportingPeriod, setReportingPeriod] = useState<string>(() =>
    new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date())
  );

  // CSV file contents (Current Period)
  const [gscQueriesCsv, setGscQueriesCsv] = useState<string>('');
  const [gscQueriesFileName, setGscQueriesFileName] = useState<string>('');
  const [gscPagesCsv, setGscPagesCsv] = useState<string>('');
  const [gscPagesFileName, setGscPagesFileName] = useState<string>('');
  const [ga4Csv, setGa4Csv] = useState<string>('');
  const [ga4FileName, setGa4FileName] = useState<string>('');
  const [rankCsv, setRankCsv] = useState<string>('');
  const [rankFileName, setRankFileName] = useState<string>('');

  // CSV file contents (Previous Period for MoM comparison)
  const [previousGscCsv, setPreviousGscCsv] = useState<string>('');
  const [previousGscFileName, setPreviousGscFileName] = useState<string>('');
  const [previousGa4Csv, setPreviousGa4Csv] = useState<string>('');
  const [previousGa4FileName, setPreviousGa4FileName] = useState<string>('');

  // Compiler state
  const [compiling, setCompiling] = useState(false);
  const [previewData, setPreviewData] = useState<NormalizedReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New Workspace Quick Modal
  const [isQuickWsOpen, setIsQuickWsOpen] = useState(false);
  const [quickWsName, setQuickWsName] = useState('');
  const [quickWsDomain, setQuickWsDomain] = useState('');

  useEffect(() => {
    api.getWorkspaces().then(res => {
      setWorkspaces(res.workspaces);
      if (res.workspaces.length > 0) {
        setSelectedWorkspaceId(res.workspaces[0].id);
        setReportTitle(`${res.workspaces[0].clientName} - ${reportingPeriod} SEO Report`);
      }
    });
  }, []);

  const handleWorkspaceChange = (wsId: string) => {
    setSelectedWorkspaceId(wsId);
    const ws = workspaces.find(w => w.id === wsId);
    if (ws) {
      setReportTitle(`${ws.clientName} - ${reportingPeriod} SEO Report`);
    }
  };

  const handlePeriodChange = (period: string) => {
    setReportingPeriod(period);
    const ws = workspaces.find(w => w.id === selectedWorkspaceId);
    if (ws) {
      setReportTitle(`${ws.clientName} - ${period} SEO Report`);
    }
  };

  const handleQuickCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickWsName || !quickWsDomain) return;
    try {
      const res = await api.createWorkspace({
        clientName: quickWsName.trim(),
        clientDomain: quickWsDomain.trim()
      });
      setWorkspaces([res.workspace, ...workspaces]);
      setSelectedWorkspaceId(res.workspace.id);
      setReportTitle(`${res.workspace.clientName} - ${reportingPeriod} SEO Report`);
      setIsQuickWsOpen(false);
      setQuickWsName('');
      setQuickWsDomain('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create workspace.');
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (content: string) => void,
    nameSetter: (name: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    nameSetter(file.name);
    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target?.result as string;
      setter(text);
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleLoadSampleData = () => {
    if (!import.meta.env.DEV) return;
    setGscQueriesCsv(SAMPLE_GSC_QUERIES);
    setGscQueriesFileName('sample_gsc_queries.csv');
    setGscPagesCsv(SAMPLE_GSC_PAGES);
    setGscPagesFileName('sample_gsc_pages.csv');
    setGa4Csv(SAMPLE_GA4);
    setGa4FileName('sample_ga4_channels.csv');
    setRankCsv(SAMPLE_RANK);
    setRankFileName('sample_rankings.csv');
    setPreviousGscCsv(SAMPLE_PREVIOUS_GSC_QUERIES);
    setPreviousGscFileName('sample_previous_gsc_queries.csv');
    setPreviousGa4Csv(SAMPLE_PREVIOUS_GA4);
    setPreviousGa4FileName('sample_previous_ga4_channels.csv');
    setError(null);
  };

  const handlePreviewCompile = async () => {
    if (!gscQueriesCsv && !gscPagesCsv && !ga4Csv && !rankCsv) {
      setError('Please upload at least one CSV file (Google Search Console, GA4, or Rank Tracker).');
      return;
    }

    setCompiling(true);
    setError(null);
    try {
      const res = await api.compilePreview({
        gscQueriesCsv: gscQueriesCsv || undefined,
        gscPagesCsv: gscPagesCsv || undefined,
        ga4Csv: ga4Csv || undefined,
        rankCsv: rankCsv || undefined,
        previousGscCsv: previousGscCsv || undefined,
        previousGa4Csv: previousGa4Csv || undefined
      });
      setPreviewData(res.data);
    } catch (err: any) {
      console.error('Preview compilation error:', err);
      setError(err?.message || 'Failed to compile preview data.');
    } finally {
      setCompiling(false);
    }
  };

  const handleSaveAndCompile = async () => {
    if (!selectedWorkspaceId) {
      setError('Please select or create a client workspace.');
      return;
    }
    if (!reportTitle.trim()) {
      setError('Please enter a report title.');
      return;
    }
    if (!previewData) {
      // compile first
      try {
        setCompiling(true);
        const previewRes = await api.compilePreview({
          gscQueriesCsv: gscQueriesCsv || undefined,
          gscPagesCsv: gscPagesCsv || undefined,
          ga4Csv: ga4Csv || undefined,
          rankCsv: rankCsv || undefined,
          previousGscCsv: previousGscCsv || undefined,
          previousGa4Csv: previousGa4Csv || undefined
        });

        const reportRes = await api.createReport({
          workspaceId: selectedWorkspaceId,
          reportTitle: reportTitle.trim(),
          reportingPeriod: reportingPeriod.trim(),
          data: previewRes.data,
          commentary: buildDataDrivenCommentary(previewRes.data, reportingPeriod.trim()),
          branding: {
            agencyName: user?.agencyName || 'Agency Partner',
            agencyLogo: user?.agencyLogo,
            accentColor: user?.accentColor || '#4F46E5',
            showWatermark: user?.plan !== 'pro'
          }
        });

        await refreshUser();
        onReportCreated(reportRes.report.id);
      } catch (err: any) {
        console.error('Save report error:', err);
        setError(err?.message || 'Failed to create report.');
      } finally {
        setCompiling(false);
      }
      return;
    }

    // Already have previewData
    setCompiling(true);
    try {
      const reportRes = await api.createReport({
        workspaceId: selectedWorkspaceId,
        reportTitle: reportTitle.trim(),
        reportingPeriod: reportingPeriod.trim(),
        data: previewData,
        commentary: buildDataDrivenCommentary(previewData, reportingPeriod.trim()),
        branding: {
          agencyName: user?.agencyName || 'Agency Partner',
          agencyLogo: user?.agencyLogo,
          accentColor: user?.accentColor || '#4F46E5',
          showWatermark: user?.plan !== 'pro'
        }
      });

      await refreshUser();
      onReportCreated(reportRes.report.id);
    } catch (err: any) {
      console.error('Save report error:', err);
      setError(err?.message || 'Failed to create report.');
    } finally {
      setCompiling(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Wizard Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Compile Monthly Client Report</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Drop raw CSV exports to normalize metrics, sanitize formulas, and generate an executive report.
          </p>
        </div>

        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={handleLoadSampleData}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 flex items-center gap-2 self-start sm:self-auto transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Load Sample SEO CSV Data</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <div className="flex-1 font-medium">{error}</div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Workspace & Metadata */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
          <Building2 className="w-4 h-4 text-indigo-600" />
          <span>1. Client Workspace & Reporting Window</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Client Workspace
              </label>
              <button
                type="button"
                onClick={() => setIsQuickWsOpen(true)}
                className="text-[11px] font-semibold text-indigo-600 hover:underline"
              >
                + New Client
              </button>
            </div>
            {workspaces.length > 0 ? (
              <select
                value={selectedWorkspaceId}
                onChange={e => handleWorkspaceChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>
                    {ws.clientName} ({ws.clientDomain})
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={() => setIsQuickWsOpen(true)}
                className="w-full px-3 py-2 bg-indigo-50 border border-dashed border-indigo-300 rounded-xl text-xs font-semibold text-indigo-700 text-center"
              >
                + Create Workspace First
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Reporting Period
            </label>
            <input
              type="text"
              value={reportingPeriod}
              onChange={e => handlePeriodChange(e.target.value)}
              placeholder="e.g. October 2026"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Report Title
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={e => setReportTitle(e.target.value)}
              placeholder="e.g. Client Name - October 2026 SEO Report"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Step 2: CSV Upload Dropzones */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <UploadCloud className="w-4 h-4 text-indigo-600" />
            <span>2. Upload Raw CSV Exports</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Automatic Delimiter & Column Detection</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* GSC Queries CSV */}
          <div className={`border-2 rounded-xl p-4 transition-all ${gscQueriesCsv ? 'border-emerald-300 bg-emerald-50/20' : 'border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50/50'}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className={`w-5 h-5 ${gscQueriesCsv ? 'text-emerald-600' : 'text-indigo-600'}`} />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Google Search Console: Queries</span>
                  <span className="text-[10px] text-slate-500">Queries.csv (Clicks, Impressions, CTR, Position)</span>
                </div>
              </div>
              {gscQueriesCsv && (
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}
            </div>

            <div className="mt-3">
              <label className="block w-full text-center px-3 py-2 bg-white border border-slate-200 hover:border-indigo-400 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer shadow-xs transition-colors">
                <span>{gscQueriesFileName || 'Choose GSC Queries CSV'}</span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={e => handleFileUpload(e, setGscQueriesCsv, setGscQueriesFileName)}
                  className="hidden"
                />
              </label>
            </div>
            {gscQueriesCsv && (
              <div className="mt-2 text-[11px] text-emerald-700 font-mono truncate">
                ✓ {gscQueriesCsv.split('\n').filter(l => l.trim()).length} rows loaded
              </div>
            )}
          </div>

          {/* GSC Pages CSV */}
          <div className={`border-2 rounded-xl p-4 transition-all ${gscPagesCsv ? 'border-emerald-300 bg-emerald-50/20' : 'border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50/50'}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className={`w-5 h-5 ${gscPagesCsv ? 'text-emerald-600' : 'text-indigo-600'}`} />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Google Search Console: Pages</span>
                  <span className="text-[10px] text-slate-500">Pages.csv (Top Landing Pages & Performance)</span>
                </div>
              </div>
              {gscPagesCsv && (
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}
            </div>

            <div className="mt-3">
              <label className="block w-full text-center px-3 py-2 bg-white border border-slate-200 hover:border-indigo-400 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer shadow-xs transition-colors">
                <span>{gscPagesFileName || 'Choose GSC Pages CSV'}</span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={e => handleFileUpload(e, setGscPagesCsv, setGscPagesFileName)}
                  className="hidden"
                />
              </label>
            </div>
            {gscPagesCsv && (
              <div className="mt-2 text-[11px] text-emerald-700 font-mono truncate">
                ✓ {gscPagesCsv.split('\n').filter(l => l.trim()).length} rows loaded
              </div>
            )}
          </div>

          {/* GA4 Traffic Acquisition CSV */}
          <div className={`border-2 rounded-xl p-4 transition-all ${ga4Csv ? 'border-emerald-300 bg-emerald-50/20' : 'border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50/50'}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className={`w-5 h-5 ${ga4Csv ? 'text-emerald-600' : 'text-indigo-600'}`} />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Google Analytics 4: Channels</span>
                  <span className="text-[10px] text-slate-500">Traffic Acquisition CSV (Users, Sessions, Key Events)</span>
                </div>
              </div>
              {ga4Csv && (
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}
            </div>

            <div className="mt-3">
              <label className="block w-full text-center px-3 py-2 bg-white border border-slate-200 hover:border-indigo-400 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer shadow-xs transition-colors">
                <span>{ga4FileName || 'Choose GA4 CSV (Optional)'}</span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={e => handleFileUpload(e, setGa4Csv, setGa4FileName)}
                  className="hidden"
                />
              </label>
            </div>
            {ga4Csv && (
              <div className="mt-2 text-[11px] text-emerald-700 font-mono truncate">
                ✓ {ga4Csv.split('\n').filter(l => l.trim()).length} rows loaded
              </div>
            )}
          </div>

          {/* Rank Tracker CSV */}
          <div className={`border-2 rounded-xl p-4 transition-all ${rankCsv ? 'border-emerald-300 bg-emerald-50/20' : 'border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50/50'}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className={`w-5 h-5 ${rankCsv ? 'text-emerald-600' : 'text-indigo-600'}`} />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Keyword Rank Tracker</span>
                  <span className="text-[10px] text-slate-500">Positions CSV (Semrush, Ahrefs, SERPWatcher exports)</span>
                </div>
              </div>
              {rankCsv && (
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}
            </div>

            <div className="mt-3">
              <label className="block w-full text-center px-3 py-2 bg-white border border-slate-200 hover:border-indigo-400 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer shadow-xs transition-colors">
                <span>{rankFileName || 'Choose Rank Tracker CSV (Optional)'}</span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={e => handleFileUpload(e, setRankCsv, setRankFileName)}
                  className="hidden"
                />
              </label>
            </div>
            {rankCsv && (
              <div className="mt-2 text-[11px] text-emerald-700 font-mono truncate">
                ✓ {rankCsv.split('\n').filter(l => l.trim()).length} rows loaded
              </div>
            )}
          </div>
        </div>

        {/* Optional: Previous Period Exports for Month-over-Month Comparison */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-xs font-bold text-slate-900 block">
              Month-over-Month (MoM) Comparison Data (Optional)
            </span>
            <span className="text-[11px] text-slate-500">
              Upload prior-period CSVs to automatically calculate % MoM change deltas across all KPIs.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Previous Period GSC Queries */}
            <div className={`border-2 rounded-xl p-4 transition-all ${previousGscCsv ? 'border-emerald-300 bg-emerald-50/20' : 'border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50/50'}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className={`w-5 h-5 ${previousGscCsv ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Previous Period: GSC Queries</span>
                    <span className="text-[10px] text-slate-500">Prior Month Queries.csv (for Clicks/Impr/CTR delta)</span>
                  </div>
                </div>
                {previousGscCsv && (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                )}
              </div>

              <div className="mt-3">
                <label className="block w-full text-center px-3 py-2 bg-white border border-slate-200 hover:border-indigo-400 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer shadow-xs transition-colors">
                  <span>{previousGscFileName || 'Choose Previous Month GSC Queries CSV'}</span>
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={e => handleFileUpload(e, setPreviousGscCsv, setPreviousGscFileName)}
                    className="hidden"
                  />
                </label>
              </div>
              {previousGscCsv && (
                <div className="mt-2 text-[11px] text-emerald-700 font-mono truncate">
                  ✓ {previousGscCsv.split('\n').filter(l => l.trim()).length} rows loaded (prior month baseline)
                </div>
              )}
            </div>

            {/* Previous Period GA4 Traffic */}
            <div className={`border-2 rounded-xl p-4 transition-all ${previousGa4Csv ? 'border-emerald-300 bg-emerald-50/20' : 'border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50/50'}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className={`w-5 h-5 ${previousGa4Csv ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Previous Period: GA4 Channels</span>
                    <span className="text-[10px] text-slate-500">Prior Month Traffic Acquisition CSV (Sessions delta)</span>
                  </div>
                </div>
                {previousGa4Csv && (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                )}
              </div>

              <div className="mt-3">
                <label className="block w-full text-center px-3 py-2 bg-white border border-slate-200 hover:border-indigo-400 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer shadow-xs transition-colors">
                  <span>{previousGa4FileName || 'Choose Previous Month GA4 CSV'}</span>
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={e => handleFileUpload(e, setPreviousGa4Csv, setPreviousGa4FileName)}
                    className="hidden"
                  />
                </label>
              </div>
              {previousGa4Csv && (
                <div className="mt-2 text-[11px] text-emerald-700 font-mono truncate">
                  ✓ {previousGa4Csv.split('\n').filter(l => l.trim()).length} rows loaded (prior month baseline)
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handlePreviewCompile}
            disabled={compiling || (!gscQueriesCsv && !gscPagesCsv && !ga4Csv && !rankCsv)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>{compiling ? 'Parsing & Sanitizing...' : 'Parse & Validate Metrics'}</span>
          </button>
        </div>
      </div>

      {/* Step 3: Parse Preview Card if available */}
      {previewData && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>3. Data Sanitization & KPI Pre-flight Summary</span>
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-mono text-[11px] rounded-full font-bold">
              All Formula Injections Neutralized
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Total Clicks</span>
                {previewData.kpis.clicks.previous > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${previewData.kpis.clicks.changePercent >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {previewData.kpis.clicks.changePercent >= 0 ? '↑ +' : '↓ '}
                    {previewData.kpis.clicks.changePercent.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                {previewData.kpis.clicks.current.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Total Impressions</span>
                {previewData.kpis.impressions.previous > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${previewData.kpis.impressions.changePercent >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {previewData.kpis.impressions.changePercent >= 0 ? '↑ +' : '↓ '}
                    {previewData.kpis.impressions.changePercent.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                {previewData.kpis.impressions.current.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Avg CTR</span>
                {previewData.kpis.ctr.previous > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${previewData.kpis.ctr.changePercent >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {previewData.kpis.ctr.changePercent >= 0 ? '↑ +' : '↓ '}
                    {previewData.kpis.ctr.changePercent.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                {previewData.kpis.ctr.current.toFixed(2)}%
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Avg Position</span>
                {previewData.kpis.avgPosition.previous > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${previewData.kpis.avgPosition.changePercent <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {previewData.kpis.avgPosition.changePercent <= 0 ? '↑ ' : '↓ +'}
                    {previewData.kpis.avgPosition.changePercent.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                {previewData.kpis.avgPosition.current.toFixed(1)}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Detected <span className="font-semibold text-slate-800">{previewData.topQueries.length} Search Queries</span>,{' '}
            <span className="font-semibold text-slate-800">{previewData.topPages.length} Landing Pages</span>,{' '}
            <span className="font-semibold text-slate-800">{previewData.topGainers.length} Rank Gainers</span>, and{' '}
            <span className="font-semibold text-slate-800">{previewData.topLosers.length} Rank Losers</span>.
          </div>
        </div>
      )}

      {/* Compile & Action Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-slate-600 hover:text-slate-900 text-xs font-semibold hover:bg-slate-100 rounded-xl transition-colors"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSaveAndCompile}
          disabled={compiling || (!gscQueriesCsv && !gscPagesCsv && !ga4Csv && !rankCsv)}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5 flex items-center gap-2 disabled:opacity-50 disabled:transform-none"
        >
          <span>{compiling ? 'Compiling Report...' : 'Compile & Launch Report'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Quick New Workspace Modal */}
      {isQuickWsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900">Add New Client Workspace</h3>
            <p className="text-xs text-slate-500 mt-0.5">Create a workspace for grouping monthly reports</p>
            <form onSubmit={handleQuickCreateWorkspace} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Client Business Name
                </label>
                <input
                  type="text"
                  required
                  value={quickWsName}
                  onChange={e => setQuickWsName(e.target.value)}
                  placeholder="e.g. Apex Dental Care"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Client Primary Domain
                </label>
                <input
                  type="text"
                  required
                  value={quickWsDomain}
                  onChange={e => setQuickWsDomain(e.target.value)}
                  placeholder="e.g. apexdental.com"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickWsOpen(false)}
                  className="px-4 py-2 text-slate-600 text-sm font-semibold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
                >
                  Create Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
