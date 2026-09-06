# ReportDrop — Test Strategy & Quality Assurance Framework

**Document Version:** 1.0.0  
**Status:** Approved  
**Author:** Principal QA Architect & Full-Stack Test Engineer  
**Date:** September 2026  

---

## 1. Testing Pyramid & Test Levels

```text
               ┌───────────────────────┐
               │    Playwright E2E     │  (Full User Journeys, Share Links, PDF print)
               ├───────────────────────┤
               │   Integration Tests   │  (D1 DB, Auth API, Report CRUD, Payments)
               ├───────────────────────┤
               │   Unit & Logic Tests  │  (CSV Parser, Normalizer, KPI Math, Security)
               └───────────────────────┘
```

---

## 2. Test Suites Matrix

### 2.1 Unit Tests (Vitest)
* **CSV Parsing & Sanitization:**
  * Valid GSC queries and pages CSVs.
  * Valid GA4 traffic acquisition CSVs.
  * Valid Rank tracker CSVs.
  * Formula injection neutralization (`=SUM(A1:A10)`, `+cmd|' /C ...'`).
  * Malformed, missing column, empty, and huge CSV edge cases.
* **KPI & Normalization Math:**
  * Zero impressions, zero clicks (CTR = 0%, no divide-by-zero crashes).
  * MoM calculation with zero previous period (safe fallback).
  * Top gainers and losers ranking movement calculation.
  * Search position delta calculation (lower position number = positive gain).

### 2.2 Integration Tests (Vitest + D1 In-Memory/Worker Mock)
* **Authentication Flow:** Registration, Password Hashing, Login, Token validation, Me endpoint, Logout.
* **Workspace & Report Lifecycle:** Create Workspace, Add Report, Read with ownership isolation, Update, Delete with cascade.
* **IDOR Security Verification:** User A cannot access or mutate User B's workspace or report.
* **Quota Enforcement:** Free tier allows 1 report; 2nd report blocked with 403 `QUOTA_EXCEEDED` until upgraded.
* **Payment Verification:** Valid Razorpay signature activates Pro plan; forged signature is rejected with 400.

### 2.3 E2E Tests (Playwright)
* **User Journey 1:** Complete Signup → Workspace Setup → GSC/GA4/Rank CSV Upload → Report Compilation → Review KPIs.
* **User Journey 2:** Commentary Editing ("What Happened", "What We Did", "What's Next") → Save & Reload verification.
* **User Journey 3:** Agency Branding Customization (Agency Name, Accent Color) → Verify preview reflects custom branding.
* **User Journey 4:** Public Shareable Report Link → Access without auth → Verify read-only view and print styles.

---
