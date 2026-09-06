// Razorpay Checkout & Subscription Upgrade Modal

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { loadRazorpayCheckout } from '../services/razorpayLoader.js';
import { X, Check, Sparkles, ShieldCheck, Zap } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
  const { refreshUser, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Create the order server-side (real Razorpay Orders API). The server
      //    refuses to create an order without configured Razorpay keys
      //    (PAYMENT_CONFIG_ERROR), so this flow cannot proceed by simulation.
      const order = await api.createPaymentOrder();

      // 2. Load the checkout SDK on demand, then open the standard modal. The
      //    same real Razorpay checkout runs in development and production —
      //    there is no simulated payment path.
      try {
        await loadRazorpayCheckout();
      } catch (loadErr) {
        setError('Payment processor unavailable. Please refresh and try again.');
        setLoading(false);
        console.error('Razorpay SDK failed to load:', loadErr);
        return;
      }

      if (typeof window !== 'undefined' && window.Razorpay) {
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'ReportDrop',
          description: 'Agency Pro Monthly Plan',
          order_id: order.orderId,
          prefill: {
            name: user?.fullName,
            email: user?.email
          },
          theme: { color: '#4F46E5' },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await api.verifyPayment(response);
              setSuccess(true);
              await refreshUser();
              setTimeout(() => {
                onClose();
                setSuccess(false);
              }, 1500);
            } catch (err: any) {
              setError(err?.message || 'Payment verification failed.');
            } finally {
              setLoading(false);
            }
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
            }
          }
        });
        rzp.open();
        return;
      }

      throw new Error('Payment processor unavailable. Please refresh and try again.');
    } catch (err: any) {
      console.error('Payment processing failed:', err);
      setError(err?.message || 'Payment processing failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-indigo-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-100 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Agency Pro Plan
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Upgrade Your Quota</h2>
          <p className="text-indigo-100 text-sm mt-1">
            Deliver polished, white-label monthly reports to all your agency clients.
          </p>
        </div>

        {/* Pricing & Features */}
        <div className="p-6 space-y-6">
          <div className="flex items-baseline justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="text-3xl font-extrabold text-slate-900">₹499<span className="text-sm font-medium text-slate-500"> / month</span></div>
              <p className="text-xs text-slate-500 mt-0.5">Billed monthly via Razorpay • Cancel anytime</p>
            </div>
            <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
              5 Reports / Mo
            </span>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Included with Pro</h4>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li className="flex items-start gap-2.5">
                <div className="bg-emerald-100 text-emerald-600 p-0.5 rounded-full mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span><strong>5 Client Reports per month</strong> (vs. 1 on Free)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="bg-emerald-100 text-emerald-600 p-0.5 rounded-full mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span><strong>Full White-Label Branding:</strong> custom logo & agency colors</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="bg-emerald-100 text-emerald-600 p-0.5 rounded-full mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span><strong>Public Client Share Links:</strong> live web viewing</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="bg-emerald-100 text-emerald-600 p-0.5 rounded-full mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span><strong>Print-Ready PDF Exports:</strong> pixel-perfect multi-page layout</span>
              </li>
            </ul>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Pro Plan Activated Successfully!
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              onClick={handleSubscribe}
              disabled={loading || success}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition duration-150 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <span>Processing Razorpay Order...</span>
              ) : success ? (
                <span>Plan Activated!</span>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white text-white" />
                  <span>Activate Pro Plan (₹499/mo)</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-slate-400">
              100% Privacy First • No Google credentials or OAuth access required
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
