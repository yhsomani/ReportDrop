// Navigation Header with White-Label Branding, Quota Badge & Modals

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { QuotaBadge } from './QuotaBadge.js';
import { UpgradeModal } from './UpgradeModal.js';
import { BrandingSettingsModal } from './BrandingSettingsModal.js';
import { FileText, Paintbrush, LogOut } from 'lucide-react';

interface NavbarProps {
  onNavigateHome?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigateHome }) => {
  const { user, logout } = useAuth();
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isBrandingOpen, setIsBrandingOpen] = useState(false);

  return (
    <>
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo and Brand */}
            <div className="flex items-center gap-3">
              <button
                onClick={onNavigateHome}
                className="flex items-center gap-2.5 text-left group focus:outline-none"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-lg text-slate-900 tracking-tight flex items-center gap-1.5">
                    ReportDrop
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                      Compiler
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
                    CSV → Branded Client Reports
                  </div>
                </div>
              </button>
            </div>

            {/* Right Controls */}
            {user && (
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Quota & Plan Tracker */}
                <QuotaBadge onUpgradeClick={() => setIsUpgradeOpen(true)} />

                {/* White-label Branding Trigger */}
                <button
                  onClick={() => setIsBrandingOpen(true)}
                  title="Customize White-Label Agency Branding"
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200 hover:border-indigo-200 flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Paintbrush className="w-4 h-4 text-indigo-600" />
                  <span className="hidden md:inline">Agency Branding</span>
                </button>

                {/* User Menu / Logout */}
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="hidden lg:block text-right">
                    <div className="text-xs font-bold text-slate-800">{user.agencyName}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{user.email}</div>
                  </div>
                  <button
                    onClick={logout}
                    title="Sign Out"
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Upgrades & Branding Modals */}
      <UpgradeModal
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
      />
      <BrandingSettingsModal
        isOpen={isBrandingOpen}
        onClose={() => setIsBrandingOpen(false)}
      />
    </>
  );
};
