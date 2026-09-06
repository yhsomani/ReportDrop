// Share Report Link & Access Permissions Modal

import React, { useState } from 'react';
import { api } from '../services/api.js';
import { X, Copy, Check, Globe, Lock, ExternalLink, ShieldCheck } from 'lucide-react';

interface ShareReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  shareToken: string;
  isPublicInitial: boolean;
  onStatusChange?: (isPublic: boolean) => void;
}

export const ShareReportModal: React.FC<ShareReportModalProps> = ({
  isOpen,
  onClose,
  reportId,
  shareToken,
  isPublicInitial,
  onStatusChange
}) => {
  const [isPublic, setIsPublic] = useState(isPublicInitial);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);

  if (!isOpen) return null;

  const origin = window.location.origin;
  const shareUrl = `${origin}/r/${shareToken}`;

  const handleTogglePublic = async (newVal: boolean) => {
    setUpdating(true);
    try {
      await api.updateReport(reportId, { isPublic: newVal });
      setIsPublic(newVal);
      if (onStatusChange) onStatusChange(newVal);
    } catch (err) {
      console.error('Failed to update public status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Share Client Report</h3>
              <p className="text-xs text-slate-500">Generate a live, unguessable public web link</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Public Access Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isPublic ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  {isPublic ? 'Public Link Enabled' : 'Report is Private'}
                </div>
                <div className="text-xs text-slate-500">
                  {isPublic ? 'Anyone with this unique token link can view' : 'Only you can view this report in dashboard'}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleTogglePublic(!isPublic)}
              disabled={updating}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isPublic ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isPublic ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Share Link Input */}
          {isPublic ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Client Direct URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 select-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleCopy}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> 128-bit Cryptographic Token
                </span>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline"
                >
                  Open Preview <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs leading-relaxed">
              Enable the public link above to share this interactive web report directly with your client.
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
