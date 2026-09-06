// Client API Gateway & Request Dispatcher

import {
  User,
  Workspace,
  Report,
  ReportBranding,
  ReportCommentary,
  NormalizedReportData
} from '../../types/index.js';

// Absolute base URL for the API server when it is served from a different origin
// than the app (e.g. a Cloudflare Worker). Honors the documented VITE_API_URL
// build-time variable; blank means same-origin (the Worker — or the Vite dev
// server's /api middleware — sits in front of the static app), so requests go
// to relative paths.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const TOKEN_KEY = 'reportdrop_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(API_BASE + endpoint, { ...options, headers });

  // The backend returns JSON for both success and error responses. A non-2xx
  // is still a genuine server answer — surface it, never mask it.
  if (!response.ok) {
    let message: string | undefined;
    try {
      const body = (await response.json()) as { message?: string };
      message = body?.message;
    } catch {
      /* non-JSON error body (e.g. a proxy/gateway error page) */
    }
    throw new Error(message || `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export const api = {
  // Auth
  async register(data: { email: string; password: string; fullName: string; agencyName?: string }) {
    const res = await request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setStoredToken(res.token);
    return res;
  },

  async login(data: { email: string; password: string }) {
    const res = await request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setStoredToken(res.token);
    return res;
  },

  async getMe() {
    return request<{ user: User; quota: { canCreate: boolean; used: number; limit: number; plan: string } }>('/api/auth/me');
  },

  async updateProfile(data: { fullName?: string; agencyName?: string; agencyLogo?: string; accentColor?: string }) {
    return request<{ user: User }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Revoke the current session server-side so the token can no longer be used,
  // even if it leaked. Best-effort: local token clearing always proceeds.
  async revokeSession() {
    try {
      await request<{ success: boolean }>('/api/auth/session', { method: 'DELETE' });
    } catch {
      // Fire-and-forget — the local logout must not be blocked by a network error.
    }
  },

  logout() {
    setStoredToken(null);
  },

  // Workspaces
  async getWorkspaces() {
    return request<{ workspaces: Workspace[] }>('/api/workspaces');
  },

  async createWorkspace(data: { clientName: string; clientDomain: string; currency?: string }) {
    return request<{ workspace: Workspace }>('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async deleteWorkspace(id: string) {
    return request<{ success: boolean }>(`/api/workspaces/${id}`, {
      method: 'DELETE'
    });
  },

  // Reports
  async compilePreview(data: {
    gscQueriesCsv?: string;
    gscPagesCsv?: string;
    ga4Csv?: string;
    rankCsv?: string;
    previousGscCsv?: string;
    previousGa4Csv?: string;
  }) {
    return request<{ data: NormalizedReportData }>('/api/reports/compile', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getReports() {
    return request<{ reports: Report[]; quota: { canCreate: boolean; used: number; limit: number; plan: string } }>('/api/reports');
  },

  async getReport(id: string) {
    return request<{ report: Report }>(`/api/reports/${id}`);
  },

  async createReport(data: {
    workspaceId: string;
    reportTitle: string;
    reportingPeriod: string;
    data: NormalizedReportData;
    commentary?: ReportCommentary;
    branding?: ReportBranding;
    isPublic?: boolean;
  }) {
    return request<{ report: Report }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateReport(id: string, data: {
    reportTitle?: string;
    commentary?: ReportCommentary;
    branding?: ReportBranding;
    isPublic?: boolean;
  }) {
    return request<{ report: Report }>(`/api/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteReport(id: string) {
    return request<{ success: boolean }>(`/api/reports/${id}`, {
      method: 'DELETE'
    });
  },

  // Public Report View
  async getPublicReport(shareToken: string) {
    return request<{
      report: {
        id: string;
        reportTitle: string;
        reportingPeriod: string;
        clientName: string;
        clientDomain: string;
        data: NormalizedReportData;
        commentary: ReportCommentary;
        branding: ReportBranding;
        createdAt: number;
      };
    }>(`/api/public/reports/${shareToken}`);
  },

  // Payments (Razorpay)
  async createPaymentOrder() {
    return request<{
      orderId: string;
      amount: number;
      currency: string;
      plan: string;
      keyId: string;
    }>('/api/payments/create-order', {
      method: 'POST'
    });
  },

  async verifyPayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    return request<{ success: boolean; plan: string; subscriptionStatus: string }>('/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};