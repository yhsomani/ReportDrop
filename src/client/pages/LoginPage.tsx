// Authentication Page (Sign In & Sign Up)

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { FileText, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long.');
        }
        await register(email, password, fullName, agencyName);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // Dev-only demo entrypoint: auto-provisions a throwaway agency account. The
  // hardcoded credentials below never ship in production builds (dev-gated).
  const handleDemoLogin = async () => {
    if (!import.meta.env.DEV) return;
    setEmail('agency@reportdrop.io');
    setPassword('Password123!');
    setFullName('Sarah Mitchell');
    setAgencyName('Elevate SEO Media');
    setError(null);
    setLoading(true);
    try {
      await login('agency@reportdrop.io', 'Password123!');
    } catch {
      // If demo account doesn't exist yet, register it automatically
      await register('agency@reportdrop.io', 'Password123!', 'Sarah Mitchell', 'Elevate SEO Media');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/30 to-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 mb-3">
          <FileText className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">ReportDrop</h1>
        <p className="mt-1 text-sm text-slate-600 max-w-sm mx-auto">
          The privacy-first CSV to client report compiler for SEO agencies & consultants.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 sm:rounded-2xl border border-slate-100 sm:px-10">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              onClick={() => { setIsRegister(false); setError(null); }}
              className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-colors ${
                !isRegister ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsRegister(true); setError(null); }}
              className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-colors ${
                isRegister ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Agency / Brand Name
                  </label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={e => setAgencyName(e.target.value)}
                    placeholder="Apex Marketing Agency"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@agency.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password {isRegister && <span className="text-slate-400 font-normal">(min. 8 characters)</span>}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-indigo-600/20 text-sm transition duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Please wait...</span>
              ) : (
                <>
                  <span>{isRegister ? 'Start Free Trial' : 'Sign In to Dashboard'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo Quick Button — dev-only, tree-shaken from production builds */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <button
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-xl text-xs transition duration-150 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Explore Demo Agency Account</span>
              </button>
            </div>
          )}
        </div>

        {/* Value Prop Badges */}
        <div className="mt-8 grid grid-cols-2 gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Zero Google OAuth Required</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>CSV Formula Sanitization</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>White-Label Client PDFs</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>128-bit Public Share Links</span>
          </div>
        </div>
      </div>
    </div>
  );
};
