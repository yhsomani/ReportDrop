// Agency Dashboard: Workspaces, Reports, and Client Management

import React, { useState, useEffect } from 'react';
import { Workspace, Report } from '../../types/index.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { ShareReportModal } from '../components/ShareReportModal.js';
import { UpgradeModal } from '../components/UpgradeModal.js';
import {
  Plus,
  FilePlus2,
  Building2,
  FileText,
  Globe,
  Lock,
  Trash2,
  Search,
  Sparkles,
  Calendar,
  AlertCircle,
  Eye
} from 'lucide-react';

interface DashboardPageProps {
  onCreateReport: () => void;
  onOpenReport: (reportId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onCreateReport, onOpenReport }) => {
  const { user, quota, refreshUser } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isNewWorkspaceOpen, setIsNewWorkspaceOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientDomain, setNewClientDomain] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  const [activeShareReport, setActiveShareReport] = useState<Report | null>(null);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wsRes, repRes] = await Promise.all([
        api.getWorkspaces(),
        api.getReports()
      ]);
      setWorkspaces(wsRes.workspaces);
      setReports(repRes.reports);
      await refreshUser();
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientDomain) return;
    setCreatingWorkspace(true);
    try {
      const res = await api.createWorkspace({
        clientName: newClientName.trim(),
        clientDomain: newClientDomain.trim()
      });
      setWorkspaces([res.workspace, ...workspaces]);
      setNewClientName('');
      setNewClientDomain('');
      setIsNewWorkspaceOpen(false);
    } catch (err) {
      console.error('Failed to create workspace:', err);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const handleDeleteWorkspace = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete workspace "${name}"? All associated reports will also be deleted.`)) {
      return;
    }
    try {
      await api.deleteWorkspace(id);
      setWorkspaces(workspaces.filter(w => w.id !== id));
      setReports(reports.filter(r => r.workspaceId !== id));
      await refreshUser();
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    }
  };

  const handleDeleteReport = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete report "${title}"?`)) {
      return;
    }
    try {
      await api.deleteReport(id);
      setReports(reports.filter(r => r.id !== id));
      await refreshUser();
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  const handleStartReportCreation = () => {
    if (quota && !quota.canCreate) {
      setIsUpgradeOpen(true);
      return;
    }
    onCreateReport();
  };

  const filteredReports = reports.filter(r => {
    const ws = workspaces.find(w => w.id === r.workspaceId);
    const text = `${r.reportTitle} ${r.reportingPeriod} ${ws?.clientName || ''}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / Welcome Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              {user?.agencyName} Dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">SEO Client Report Compiler</h1>
            <p className="text-indigo-200 text-sm mt-1 max-w-xl">
              Turn raw GSC, GA4, and Rank Tracker CSV exports into polished, executive-ready monthly reports in seconds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsNewWorkspaceOpen(true)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-sm border border-white/10 transition-colors flex items-center gap-1.5"
            >
              <Building2 className="w-4 h-4" />
              <span>+ New Client Workspace</span>
            </button>
            <button
              onClick={handleStartReportCreation}
              className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>Compile New Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quota warning banner if limit reached */}
      {quota && !quota.canCreate && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4 text-amber-900">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-bold">Report Quota Limit Reached ({quota.used}/{quota.limit}): </span>
              Upgrade to Agency Pro for 5 monthly reports, custom branding, and client public share links.
            </div>
          </div>
          <button
            onClick={() => setIsUpgradeOpen(true)}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors flex-shrink-0"
          >
            Upgrade (₹499/mo)
          </button>
        </div>
      )}

      {/* Client Workspaces Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Client Workspaces</h2>
            <p className="text-xs text-slate-500">Organize client domains and reporting history</p>
          </div>
          <button
            onClick={() => setIsNewWorkspaceOpen(true)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Client
          </button>
        </div>

        {workspaces.length === 0 && !loading ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No client workspaces yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Create your first client workspace to start organizing reports.
            </p>
            <button
              onClick={() => setIsNewWorkspaceOpen(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm"
            >
              + Create Client Workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {workspaces.map(ws => {
              const wsReportCount = reports.filter(r => r.workspaceId === ws.id).length;
              return (
                <div
                  key={ws.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                      {ws.clientName.substring(0, 2)}
                    </div>
                    <button
                      onClick={() => handleDeleteWorkspace(ws.id, ws.clientName)}
                      title="Delete Workspace"
                      className="text-slate-300 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-3 truncate">{ws.clientName}</h3>
                  <div className="text-xs text-slate-500 font-mono truncate">{ws.clientDomain}</div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
                    <span>{wsReportCount} {wsReportCount === 1 ? 'Report' : 'Reports'}</span>
                    <button
                      onClick={handleStartReportCreation}
                      className="text-indigo-600 font-semibold hover:underline"
                    >
                      + Compile Report
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reports List Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Generated Reports</h2>
            <p className="text-xs text-slate-500">View, edit commentary, generate client share links, or print PDFs</p>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {filteredReports.length === 0 && !loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">No reports generated yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Upload your Google Search Console, Google Analytics 4, or Rank Tracker CSV exports to compile your first client-ready monthly report.
            </p>
            <button
              onClick={handleStartReportCreation}
              className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
            >
              + Compile First Report
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Report Title</th>
                    <th className="px-6 py-3.5">Client Workspace</th>
                    <th className="px-6 py-3.5">Reporting Period</th>
                    <th className="px-6 py-3.5">Share Link</th>
                    <th className="px-6 py-3.5">Created</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReports.map(report => {
                    const ws = workspaces.find(w => w.id === report.workspaceId);
                    return (
                      <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">
                          <button
                            onClick={() => onOpenReport(report.id)}
                            className="hover:text-indigo-600 flex items-center gap-2 text-left"
                          >
                            <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <span>{report.reportTitle}</span>
                          </button>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">
                          {ws?.clientName || 'Client'}
                          <span className="block text-[11px] text-slate-400 font-mono">{ws?.clientDomain}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded-md text-[11px]">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {report.reportingPeriod}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setActiveShareReport(report)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                              report.isPublic
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {report.isPublic ? <Globe className="w-3 h-3 text-emerald-600" /> : <Lock className="w-3 h-3" />}
                            {report.isPublic ? 'Public Active' : 'Private'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-[11px]">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onOpenReport(report.id)}
                              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => setActiveShareReport(report)}
                              title="Share Link"
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Globe className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteReport(report.id, report.reportTitle)}
                              title="Delete Report"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* New Workspace Modal */}
      {isNewWorkspaceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900">Add Client Workspace</h3>
            <p className="text-xs text-slate-500 mt-0.5">Workspace for grouping monthly reports per client domain</p>
            <form onSubmit={handleCreateWorkspace} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Client Business Name
                </label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  placeholder="e.g. Acme Dental Clinic"
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
                  value={newClientDomain}
                  onChange={e => setNewClientDomain(e.target.value)}
                  placeholder="e.g. acmedental.com"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewWorkspaceOpen(false)}
                  className="px-4 py-2 text-slate-600 text-sm font-semibold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingWorkspace}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {creatingWorkspace ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Report Modal */}
      {activeShareReport && (
        <ShareReportModal
          isOpen={Boolean(activeShareReport)}
          onClose={() => setActiveShareReport(null)}
          reportId={activeShareReport.id}
          shareToken={activeShareReport.shareToken}
          isPublicInitial={activeShareReport.isPublic}
          onStatusChange={newPub => {
            setReports(reports.map(r => r.id === activeShareReport.id ? { ...r, isPublic: newPub } : r));
          }}
        />
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
      />
    </div>
  );
};
