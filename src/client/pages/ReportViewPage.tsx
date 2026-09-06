// Report View, Customization, and Share Portal

import React, { useState, useEffect } from 'react';
import { Report, ReportCommentary, ReportBranding } from '../../types/index.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  ArrowLeft,
  Printer,
  Share2,
  Check,
  Sparkles,
  TrendingUp,
  TrendingDown,
  MousePointerClick,
  Eye,
  Percent,
  Compass,
  Lock,
  Globe,
  Plus,
  Trash2,
  Palette,
  Edit3
} from 'lucide-react';

interface ReportViewPageProps {
  reportId: string;
  onBack: () => void;
}

export const ReportViewPage: React.FC<ReportViewPageProps> = ({ reportId, onBack }) => {
  const { user } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Editable fields
  const [reportTitle, setReportTitle] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [commentary, setCommentary] = useState<ReportCommentary>({});
  const [branding, setBranding] = useState<ReportBranding>({
    agencyName: '',
    accentColor: '#4F46E5',
    showWatermark: true
  });

  // Key wins / improvement / priority input buffers
  const [newWin, setNewWin] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newPriority, setNewPriority] = useState('');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const data = await api.getReport(reportId);
        setReport(data.report);
        setReportTitle(data.report.reportTitle);
        setIsPublic(data.report.isPublic);
        setCommentary(data.report.commentary || {});
        setBranding(data.report.branding || {
          agencyName: user?.agencyName || 'My Agency',
          accentColor: user?.accentColor || '#4F46E5',
          showWatermark: user?.plan !== 'pro'
        });
      } catch (err) {
        console.error('Failed to load report:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [reportId, user]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await api.updateReport(reportId, {
        reportTitle,
        commentary,
        branding,
        isPublic
      });
      setReport(updated.report);
      setEditMode(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!report?.shareToken) return;
    const url = `${window.location.origin}/r/${report.shareToken}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const addWin = () => {
    if (!newWin.trim()) return;
    setCommentary(prev => ({
      ...prev,
      keyWins: [...(prev.keyWins || []), newWin.trim()]
    }));
    setNewWin('');
  };

  const removeWin = (idx: number) => {
    setCommentary(prev => ({
      ...prev,
      keyWins: prev.keyWins?.filter((_, i) => i !== idx)
    }));
  };

  const addArea = () => {
    if (!newArea.trim()) return;
    setCommentary(prev => ({
      ...prev,
      areasForImprovement: [...(prev.areasForImprovement || []), newArea.trim()]
    }));
    setNewArea('');
  };

  const removeArea = (idx: number) => {
    setCommentary(prev => ({
      ...prev,
      areasForImprovement: prev.areasForImprovement?.filter((_, i) => i !== idx)
    }));
  };

  const addPriority = () => {
    if (!newPriority.trim()) return;
    setCommentary(prev => ({
      ...prev,
      nextMonthPriorities: [...(prev.nextMonthPriorities || []), newPriority.trim()]
    }));
    setNewPriority('');
  };

  const removePriority = (idx: number) => {
    setCommentary(prev => ({
      ...prev,
      nextMonthPriorities: prev.nextMonthPriorities?.filter((_, i) => i !== idx)
    }));
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading report data...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-md mx-auto my-16 text-center p-8 bg-white rounded-2xl border border-slate-200">
        <h3 className="text-base font-bold text-slate-900 mb-2">Report Not Found</h3>
        <p className="text-xs text-slate-500 mb-4">The requested report could not be found or you do not have permission to view it.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const { data } = report;
  const accentColor = branding.accentColor || '#4F46E5';

  return (
    <div className="pb-16">
      {/* Top Action Bar */}
      <div className="no-print bg-white border-b border-slate-200 sticky top-16 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap justify-between items-center gap-3">
          <button
            onClick={onBack}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <button
                  onClick={() => setEditMode(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditMode(true)}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Commentary & Brand</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-indigo-600" />}
                  <span>{isCopied ? 'Link Copied!' : 'Share Link'}</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print PDF</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print-container">
        {/* Editor Drawer if in edit mode */}
        {editMode && (
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-indigo-100 pb-3">
              <Palette className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Customization & Commentary Editor</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Report Title</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={e => setReportTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Agency Display Name</label>
                <input
                  type="text"
                  value={branding.agencyName}
                  onChange={e => setBranding({ ...branding, agencyName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Brand Accent Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={branding.accentColor}
                    onChange={e => setBranding({ ...branding, accentColor: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                  />
                  <span className="font-mono text-xs text-slate-600 uppercase">{branding.accentColor}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isPublicCheck"
                  checked={isPublic}
                  onChange={e => setIsPublic(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <label htmlFor="isPublicCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Enable Public Share URL Access
                </label>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Executive Summary / Performance Overview</label>
                <textarea
                  rows={3}
                  value={commentary.executiveSummary || ''}
                  onChange={e => setCommentary({ ...commentary, executiveSummary: e.target.value })}
                  placeholder="Provide an executive-level recap of organic performance and major milestones..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">What Happened (Context & Factors)</label>
                <textarea
                  rows={3}
                  value={commentary.whatHappened || ''}
                  onChange={e => setCommentary({ ...commentary, whatHappened: e.target.value })}
                  placeholder="Explain search algorithm updates, seasonal fluctuations, or crawl changes..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Dynamic Lists */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Wins */}
                <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-emerald-800">Key Wins</span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newWin}
                      onChange={e => setNewWin(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addWin())}
                      placeholder="Add win..."
                      className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg"
                    />
                    <button onClick={addWin} className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ul className="space-y-1 text-xs">
                    {commentary.keyWins?.map((w, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-1 p-1 bg-slate-50 rounded">
                        <span className="truncate">{w}</span>
                        <button onClick={() => removeWin(idx)} className="text-rose-500 hover:text-rose-700">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Areas of focus */}
                <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-amber-800">Focus Areas</span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newArea}
                      onChange={e => setNewArea(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addArea())}
                      placeholder="Add area..."
                      className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg"
                    />
                    <button onClick={addArea} className="px-2 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ul className="space-y-1 text-xs">
                    {commentary.areasForImprovement?.map((a, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-1 p-1 bg-slate-50 rounded">
                        <span className="truncate">{a}</span>
                        <button onClick={() => removeArea(idx)} className="text-rose-500 hover:text-rose-700">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Priorities */}
                <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-indigo-800">Next Month Priorities</span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newPriority}
                      onChange={e => setNewPriority(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPriority())}
                      placeholder="Add priority..."
                      className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg"
                    />
                    <button onClick={addPriority} className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ul className="space-y-1 text-xs">
                    {commentary.nextMonthPriorities?.map((p, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-1 p-1 bg-slate-50 rounded">
                        <span className="truncate">{p}</span>
                        <button onClick={() => removePriority(idx)} className="text-rose-500 hover:text-rose-700">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report Header Card */}
        <div
          className="rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${accentColor} 0%, #0f172a 100%)` }}
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{branding.agencyName} SEO Report</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{reportTitle}</h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-white/80 font-medium">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  Period: <strong>{report.reportingPeriod}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  {report.isPublic ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-[11px] font-bold">
                      Public Link Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 text-[11px] font-bold">
                      <Lock className="w-3 h-3" /> Private
                    </span>
                  )}
                </span>
              </div>
            </div>

            {branding.agencyLogo && (
              <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 self-start md:self-auto">
                <img src={branding.agencyLogo} alt={branding.agencyName} className="h-10 max-w-[140px] object-contain" />
              </div>
            )}
          </div>
        </div>

        {/* Executive Summary & Strategic Review */}
        {commentary && (commentary.executiveSummary || commentary.whatHappened || commentary.keyWins?.length || commentary.areasForImprovement?.length || commentary.nextMonthPriorities?.length) && (
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
                    {commentary.keyWins.map((win, idx) => (
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
                    {commentary.areasForImprovement.map((area, idx) => (
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
                    {commentary.nextMonthPriorities.map((pri, idx) => (
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
                  {data.topQueries.slice(0, 15).map((q, idx) => (
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
                  {data.topPages.slice(0, 10).map((p, idx) => (
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
                    {data.topGainers.map((k, idx) => (
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
                    {data.topLosers.map((k, idx) => (
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
                  {data.channelBreakdown.map((c, idx) => (
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
            Prepared on {new Date(report.createdAt).toLocaleDateString()} by <span className="font-semibold text-slate-700">{branding.agencyName}</span>
          </div>
          {branding.showWatermark ? (
            <div className="flex items-center gap-1 text-[11px]">
              <span>Powered by</span>
              <span className="font-bold text-indigo-600">ReportDrop</span>
            </div>
          ) : (
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              {branding.agencyName} Confidential Client Report
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
