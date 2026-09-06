// Quota Usage Indicator Badge & Progress Indicator

import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Sparkles, AlertCircle } from 'lucide-react';

interface QuotaBadgeProps {
  onUpgradeClick: () => void;
}

export const QuotaBadge: React.FC<QuotaBadgeProps> = ({ onUpgradeClick }) => {
  const { quota } = useAuth();

  if (!quota) return null;

  const isPro = quota.plan === 'pro';
  const percentage = Math.min(100, Math.round((quota.used / quota.limit) * 100));
  const isFull = !quota.canCreate;

  return (
    <div className="flex items-center gap-3 bg-slate-100 hover:bg-slate-200/80 transition-colors border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
      <div className="flex flex-col gap-1 min-w-[100px]">
        <div className="flex justify-between items-center text-[11px] font-medium text-slate-600">
          <span className="flex items-center gap-1">
            {isPro ? (
              <span className="text-indigo-600 font-semibold flex items-center gap-0.5">
                <Sparkles className="w-3 h-3" /> Pro Tier
              </span>
            ) : (
              <span className="text-slate-500 font-semibold">Free Tier</span>
            )}
          </span>
          <span className={isFull ? 'text-rose-600 font-bold' : 'text-slate-700 font-bold'}>
            {quota.used}/{quota.limit} Reports
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isFull ? 'bg-rose-500' : percentage >= 80 ? 'bg-amber-500' : 'bg-indigo-600'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {!isPro && (
        <button
          onClick={onUpgradeClick}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-2.5 py-1 rounded shadow-sm text-xs transition-colors flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3 text-indigo-200" />
          Upgrade
        </button>
      )}

      {isFull && isPro && (
        <div className="flex items-center gap-1 text-amber-700 text-[11px]">
          <AlertCircle className="w-3 h-3" />
          Limit Reached
        </div>
      )}
    </div>
  );
};
