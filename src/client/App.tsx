// Main React App with View Router & Auth Integration

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ReportWizardPage } from './pages/ReportWizardPage.js';
import { ReportViewPage } from './pages/ReportViewPage.js';
import { PublicReportPage } from './pages/PublicReportPage.js';

type ViewMode = 'dashboard' | 'wizard' | 'report';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Check if current URL is a public share link: /r/:shareToken
  const path = window.location.pathname;
  if (path.startsWith('/r/')) {
    const shareToken = path.replace('/r/', '').split('/')[0];
    if (shareToken) {
      return <PublicReportPage shareToken={shareToken} />;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Initializing ReportDrop session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleOpenReport = (reportId: string) => {
    setActiveReportId(reportId);
    setCurrentView('report');
  };

  const handleReportCreated = (reportId: string) => {
    setActiveReportId(reportId);
    setCurrentView('report');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar onNavigateHome={() => setCurrentView('dashboard')} />

      <main className="flex-1">
        {currentView === 'dashboard' && (
          <DashboardPage
            onCreateReport={() => setCurrentView('wizard')}
            onOpenReport={handleOpenReport}
          />
        )}

        {currentView === 'wizard' && (
          <ReportWizardPage
            onCancel={() => setCurrentView('dashboard')}
            onReportCreated={handleReportCreated}
          />
        )}

        {currentView === 'report' && activeReportId && (
          <ReportViewPage
            reportId={activeReportId}
            onBack={() => setCurrentView('dashboard')}
          />
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  // If viewing public report, don't even wait for auth checks
  const path = window.location.pathname;
  if (path.startsWith('/r/')) {
    const shareToken = path.replace('/r/', '').split('/')[0];
    if (shareToken) {
      return <PublicReportPage shareToken={shareToken} />;
    }
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};
