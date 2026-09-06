# ReportDrop — Master Implementation Plan

**Document Version:** 1.0.0  
**Status:** Approved  
**Author:** Principal Software Architect  
**Date:** September 2026  

---

## 1. Work Breakdown Structure & Priorities

### Priority P0: Core Architecture, Database & Security Foundation
1. Setup Vite + React 18 + TypeScript + Tailwind CSS project with dual build configuration (Frontend SPA + Cloudflare Worker API).
2. Create SQLite/D1 database schema and migrations (`users`, `workspaces`, `reports`, `subscriptions`, `audit_events`).
3. Implement WebCrypto authentication engine: PBKDF2 password hashing, secure token generation, session management.
4. Implement IDOR-proof authorization middleware with strict `WHERE user_id = ?` query isolation.
5. Implement server-side Razorpay order creation and HMAC-SHA256 signature verification with WebCrypto.

### Priority P1: CSV Ingestion, Normalization & KPI Calculations
1. Build CSV parser engine with RFC 4180 compliance and automatic delimiter detection (comma, semicolon, tab).
2. Implement formula injection protection (neutralizing `=`, `+`, `-`, `@`, `\t`, `\r`).
3. Build schema validators and header mappers for:
   * Google Search Console (Queries & Pages exports)
   * Google Analytics 4 (Channel group / Organic traffic exports)
   * Generic Rank Trackers (Keywords, Current Rank, Previous Rank, Search Volume)
4. Implement KPI calculation engine:
   * Total Clicks, Impressions, CTR, Avg Position, Organic Sessions
   * Month-over-Month (MoM) % changes with zero-denominator & edge case handling
   * Top 5 Gainers, Top 5 Losers ranking changes
   * Top Pages & Top Search Queries extraction

### Priority P2: Frontend Application & UI Components
1. **Authentication Screens:** Login, Register, Profile/Agency Settings.
2. **Dashboard:** Active client workspaces, report overview, quota usage indicator, upgrade trigger.
3. **Report Generation Wizard:** Multi-source CSV upload with drag-and-drop, real-time validation preview, column auto-mapping.
4. **Interactive Report View / Editor:**
   * Executive KPI Scorecard with MoM indicator badges.
   * Search Performance table (Top Queries & Top Pages).
   * Keyword Movement table (Gainers / Losers).
   * 3-Part Strategic Commentary Editor ("What Happened", "What We Did", "What's Next").
   * White-Label Agency Branding Customizer (Name, Logo, Accent Color with live theme updates).
   * Share Modal with copyable unguessable public link (`/r/:shareToken`).
   * Browser Print & PDF Export layout.

### Priority P3: Public Shared Client Report & Monetization
1. Build unauthenticated public client route (`/r/:shareToken`).
2. Implement strictly read-only public API endpoint (`GET /api/public/reports/:shareToken`).
3. Razorpay checkout integration with instant plan upgrade and quota unlocking.

### Priority P4: Testing & Quality Assurance
1. Comprehensive Unit test suite (CSV parser, Normalization, KPI calculation, Formula protection, HMAC verification).
2. Comprehensive Integration test suite (Auth API, Workspace API, Report CRUD, IDOR isolation, Quota limits).
3. Playwright E2E test suite (Full user journeys, shareable links, print view).
4. Security penetration verification tests.

---
