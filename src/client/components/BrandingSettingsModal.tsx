// White-Label Agency Branding Customizer Modal

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { X, Check, Paintbrush, Building2, Image as ImageIcon } from 'lucide-react';

interface BrandingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#4F46E5', // Indigo
  '#0284C7', // Sky Blue
  '#0D9488', // Teal
  '#059669', // Emerald
  '#D97706', // Amber
  '#DC2626', // Red
  '#9333EA', // Purple
  '#1E293B'  // Slate / Dark
];

export const BrandingSettingsModal: React.FC<BrandingSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();

  const [agencyName, setAgencyName] = useState(user?.agencyName || 'My Agency');
  const [agencyLogo, setAgencyLogo] = useState(user?.agencyLogo || '');
  const [accentColor, setAccentColor] = useState(user?.accentColor || '#4F46E5');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        agencyName: agencyName.trim(),
        agencyLogo: agencyLogo.trim() || undefined,
        accentColor: accentColor.trim()
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to save branding:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Paintbrush className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">White-Label Branding</h3>
              <p className="text-xs text-slate-500">Configure how your agency appears on client reports</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Agency Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Agency Name
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={agencyName}
                onChange={e => setAgencyName(e.target.value)}
                placeholder="e.g. Apex Growth Digital"
                required
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Agency Logo Image URL (Optional)
            </label>
            <div className="relative">
              <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="url"
                value={agencyLogo}
                onChange={e => setAgencyLogo(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Recommended: Square or horizontal PNG/SVG with transparent background.</p>
          </div>

          {/* Accent Color */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Report Accent Color
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccentColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      accentColor.toLowerCase() === color.toLowerCase()
                        ? 'ring-2 ring-offset-2 ring-slate-900 scale-110'
                        : 'hover:scale-105 opacity-85 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
              <input
                type="text"
                value={accentColor}
                onChange={e => setAccentColor(e.target.value)}
                placeholder="#4F46E5"
                pattern="^#([A-Fa-f0-9]{6})$"
                className="w-24 px-2 py-1.5 text-center font-mono text-xs uppercase bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Live Header Preview</span>
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                {agencyLogo ? (
                  <img src={agencyLogo} alt="Logo" className="h-7 w-auto object-contain" />
                ) : (
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center text-white font-black text-xs"
                    style={{ backgroundColor: accentColor }}
                  >
                    {agencyName.charAt(0) || 'A'}
                  </div>
                )}
                <div>
                  <div className="font-bold text-xs text-slate-900">{agencyName || 'Agency Name'}</div>
                  <div className="text-[10px] text-slate-400">Monthly Performance Report</div>
                </div>
              </div>
              <div
                className="px-2.5 py-1 rounded text-[11px] font-semibold text-white shadow-xs"
                style={{ backgroundColor: accentColor }}
              >
                Oct 2026
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>{saving ? 'Saving...' : 'Save Branding'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
