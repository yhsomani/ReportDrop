# ReportDrop — Product Requirements Document (PRD)

**Document Version:** 1.0.0  
**Status:** Approved  
**Author:** Principal Software Architect & Lead Product Manager  
**Date:** September 2026  

---

## 1. Product Overview & Vision

ReportDrop transforms raw, exported SEO spreadsheets into executive-ready, white-labeled monthly performance reports.

The workflow is:
```text
Upload CSVs (GSC + GA4 + Rank) 
  → Validate & Normalize 
  → Calculate KPIs & MoM Movement 
  → Add Consultant Commentary 
  → Brand (Agency Logo & Colors) 
  → Share Public Link or Print to PDF
```

---

## 2. User Stories & Acceptance Criteria

### US-1: Authentication & Account Management
* **As a** registered SEO consultant,
* **I want to** sign up, log in, and maintain a secure session,
* **So that** my client data and agency reports remain strictly confidential.

**Acceptance Criteria:**
1. User can register with email and a secure password (minimum 8 characters).
2. Password is salted and hashed using PBKDF2/WebCrypto standards.
3. Session tokens are cryptographically random, stored securely in HTTP-only/Bearer auth, and verified on every protected API call.
4. Unauthenticated users cannot access any private API or workspace.

---

### US-2: Workspace & Client Setup
* **As an** agency owner,
* **I want to** create distinct workspaces for each client with their website domain and monthly reporting period,
* **So that** historical and monthly data are organized cleanly.

**Acceptance Criteria:**
1. Authenticated user can create, view, update, and delete workspaces.
2. Each workspace belongs strictly to the authenticated user (strict user-level isolation).
3. Workspace includes: Client Name, Target Domain, Default Currency/Locale, and Reporting Defaults.

---

### US-3: Multi-Source CSV Ingestion & Validation
* **As an** SEO consultant,
* **I want to** upload CSV exports from Google Search Console, Google Analytics 4, and Rank Trackers,
* **So that** I don't have to manually format raw spreadsheets.

**Acceptance Criteria:**
1. Ingestion handles standard GSC CSV exports (`Queries.csv` / `Pages.csv` / Performance exports with columns: `Query`/`Top queries`, `Clicks`, `Impressions`, `CTR`, `Position`).
2. Ingestion handles standard GA4 CSV exports (Traffic acquisition exports with columns: `Session default channel group`, `Sessions`, `Users`, `Engagement rate`, etc.).
3. Ingestion handles Rank Tracker CSV exports (Keywords, Current Position, Previous Position, Search Volume, URL).
4. Files are validated for file size (max 10MB per file), CSV syntax, valid encoding (UTF-8/ASCII), and required columns.
5. Formula injection payloads (`=SUM()`, `+cmd|`, `-2+3`, `@IMPORT`) are sanitized immediately upon parsing.
6. Descriptive error messages indicate missing columns or malformed rows without crashing the application.

---

### US-4: Data Normalization & KPI Calculation Engine
* **As an** SEO consultant,
* **I want the system to** automatically normalize data and calculate executive metrics,
* **So that** my clients see accurate MoM changes and top performance highlights.

**Acceptance Criteria:**
1. Aggregates Total Clicks, Total Impressions, Average CTR, and Average Position from GSC data.
2. Calculates Total Organic Sessions and User counts from GA4 data.
3. Computes MoM percentage changes with safe division (handles zero denominator, negative values, and missing periods cleanly).
4. Extracts Top 5 Keyword Gainers (largest rank improvements) and Top 5 Keyword Losers.
5. Identifies Top 5 Traffic-Driving Pages and Top 5 Click-Driving Queries.

---

### US-5: Executive Commentary & Report Customization
* **As an** SEO professional,
* **I want to** write structured qualitative commentary across 3 standard sections ("What Happened", "What We Did", "What's Next"),
* **So that** my clients understand the strategic narrative behind the numbers.

**Acceptance Criteria:**
1. User can edit commentary with immediate autosave or explicit save.
2. Input is sanitized to prevent Stored XSS attacks.
3. Empty commentary states render gracefully with helpful placeholders in edit mode and clean styling in client view.

---

### US-6: Agency White-Label Branding
* **As a** boutique agency,
* **I want to** configure my agency name, upload our logo, and select our brand accent color,
* **So that** reports look like our proprietary agency deliverable.

**Acceptance Criteria:**
1. Agency branding settings: Agency Name, Logo URL / base64 image (sanitized, max 2MB), and Hex Accent Color.
2. Accent color dynamically themes report headers, metric card accents, and chart highlights.
3. Malicious SVG or script-injected image uploads are strictly rejected.

---

### US-7: Client-Facing Shareable Report & Print/PDF
* **As a** consultant,
* **I want to** share a unique, unguessable link with my client or export a pixel-perfect PDF,
* **So that** my client can review results without needing an account or login.

**Acceptance Criteria:**
1. Public report URL format: `/r/:shareToken` where `shareToken` is a 128-bit cryptographically secure random identifier.
2. Public report view is strictly **read-only** (no editing controls, no workspace navigation, no agency settings exposed).
3. Optimized `@media print` CSS formats the report into standard A4/Letter pages with proper page breaks, hidden navigation, and crisp typography.

---

### US-8: Subscription & Quota Enforcement (Razorpay)
* **As the** business owner of ReportDrop,
* **I want to** enforce a paid subscription (e.g., ₹499/mo for 5 reports) via Razorpay,
* **So that** the product generates recurring revenue and prevents unauthorized quota abuse.

**Acceptance Criteria:**
1. Free trial allows generating 1 report. Paid plan unlocks 5 active reports/month.
2. Razorpay Order creation on backend with server-authoritative pricing (never client-provided prices).
3. Razorpay payment verification using HMAC-SHA256 signature matching.
4. Razorpay webhook support with idempotency keys and signature validation.
5. Server-side quota enforcement on report generation endpoints.

---
