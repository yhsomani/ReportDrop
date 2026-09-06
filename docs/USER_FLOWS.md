# ReportDrop — User Flows, State Transitions & UX Specifications

**Document Version:** 1.0.0  
**Status:** Approved  
**Author:** Principal UX/UI Designer & Full-Stack Architect  
**Date:** September 2026  

---

## 1. Primary User Journey Flows

### Flow 1: Onboarding & First Report Creation
```text
[Landing Page]
      │
      ▼
[Signup Modal / Page] ──(Valid Credentials)──► [User Dashboard (Empty State)]
                                                       │
                                                       ▼ (Click "+ New Report")
                                             [Step 1: Client & Period Setup]
                                                       │ (Next)
                                                       ▼
                                             [Step 2: CSV Upload & Validation]
                                               ├── GSC Performance CSV
                                               ├── GA4 Traffic CSV
                                               └── Rank Tracker CSV
                                                       │ (Compile & Calculate)
                                                       ▼
                                             [Step 3: Interactive Report Builder]
                                               ├── View Calculated KPIs
                                               ├── Add Commentary ("What Happened", "What We Did", "What's Next")
                                               └── Apply Branding (Logo & Accent Color)
                                                       │
                                        ┌──────────────┴──────────────┐
                                        ▼                             ▼
                              [Copy Shareable Link]            [Print to PDF]
```

### Flow 2: Client Viewing (Public Shared Link)
```text
[Client receives /r/{shareToken}]
      │
      ▼
[Validate shareToken in DB]
      ├── If Token Invalid / Revoked ──► Render 404 "Report Not Found or Expired"
      └── If Token Valid ──► Render White-Labeled Read-Only Client Report View
                               ├── Agency Logo & Name Header
                               ├── Client Domain & Reporting Period
                               ├── Executive KPI Scorecard (MoM Changes)
                               ├── Search Performance Breakdown (Queries & Pages)
                               ├── Organic Traffic & Engagement Section
                               ├── Keyword Movement (Gainers / Losers)
                               ├── Strategic Commentary Narrative
                               └── Print to PDF Button
```

### Flow 3: Upgrade / Subscription Checkout Flow
```text
[User reaches Report Limit (Free Quota Exceeded)]
      │
      ▼
[Upgrade Banner / Modal Displayed]
      │ (Click "Upgrade to Pro - ₹499/mo")
      ▼
[POST /api/payments/create-order] ──► [Server generates Razorpay Order ID]
      │
      ▼
[Razorpay Checkout Modal Opens]
      ├── User Cancels ──► Return to Dashboard with "Payment Cancelled" Notice
      └── Payment Success ──► Razorpay returns { razorpay_order_id, razorpay_payment_id, razorpay_signature }
                                    │
                                    ▼
                      [POST /api/payments/verify]
                                    │
                      [Server checks HMAC-SHA256 signature]
                                    ├── Signature Invalid ──► 400 Bad Request
                                    └── Signature Valid ──► Update DB Subscription State to 'active' & Grant Quota
                                                                │
                                                                ▼
                                                    [Instant Access Unlocked]
```

---

## 2. Screen State Matrix

Every screen in ReportDrop must handle all 7 standard UX states:

| Screen | Loading State | Empty State | Success State | Error State | Disabled / Quota Exceeded State | Mobile View | Print View |
|---|---|---|---|---|---|---|---|
| **Dashboard** | Skeleton metric cards & list | "No reports yet. Create your first report in 60s" + CTA | Table/Grid of active reports with status & share links | Toast error with retry button | Banner indicating 5/5 reports used with upgrade CTA | Stacked card list with easy touch targets | N/A (Hidden) |
| **New Report Modal / Wizard** | Spinner on upload parsing | File dropzone with format helper text | File preview with row counts & detected columns | Inline error banner highlighting missing columns | "Upgrade required to create another report" | Fullscreen modal with responsive upload dropzones | N/A |
| **Report Editor** | Skeleton charts & KPI cards | Sections without uploaded data show optional upload prompt | Fully populated interactive report with editable commentary | Inline alert for save failures | Read-only toggle if subscription expired | Responsive tabs for Sections / Settings | N/A |
| **Public Client Report** | Smooth branded loader | Clean "Data unavailable for this period" | High-contrast, executive-ready white-labeled report | Friendly 404 / expired notice | Fully functional read-only view | Single column responsive executive summary | Pixel-perfect A4/Letter multi-page layout |

---

## 3. UI Design Specifications

### Typography & Colors
* **Primary Font:** Inter / System Font Stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)
* **Base Palette:**
  * Background: Slate 50 (`#F8FAFC`) / White (`#FFFFFF`)
  * Surface/Cards: White (`#FFFFFF`) with subtle border (`#E2E8F0`) and soft shadow (`0 1px 3px 0 rgb(0 0 0 / 0.1)`)
  * Text Primary: Slate 900 (`#0F172A`)
  * Text Muted: Slate 500 (`#64748B`)
  * Default Brand Accent: Indigo 600 (`#4F46E5`) with customizable user overrides
  * Positive / Gain: Emerald 600 (`#059669`) / Green 50 (`#ECFDF5`)
  * Negative / Loss: Rose 600 (`#E11D48`) / Rose 50 (`#FFF1F2`)

### Print & PDF CSS Constraints
* `@media print` rules:
  * Hide headers, navigation bars, action buttons, toolbars, and edit controls.
  * Reset backgrounds to pure white (`#FFFFFF`) and dark text for ink-friendly printing.
  * Force page breaks before major report sections using `page-break-before: always; break-before: page;`.
  * Ensure table rows do not split across pages with `page-break-inside: avoid; break-inside: avoid;`.

---
