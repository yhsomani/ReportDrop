# ReportDrop — Business Requirements Document (BRD)

**Document Version:** 1.0.0  
**Status:** Approved  
**Author:** Principal Software Architect & Product Manager  
**Date:** September 2026  

---

## 1. Executive Summary

**ReportDrop** is a privacy-first software tool designed to transform raw SEO CSV exports (Google Search Console, Google Analytics 4, and Keyword Rank Trackers) into beautifully branded, client-ready monthly performance reports without requiring Google OAuth connections or expensive SEO platform subscriptions.

### Core Positioning
> **"This is not another SEO analytics platform. It is a CSV → client report compiler."**

The platform eliminates the recurring friction of manual spreadsheet wrangling, chart formatting, copy-pasting, and PDF styling for independent SEO consultants and boutique agencies.

---

## 2. Problem Statement

Small SEO agencies, solo practitioners, and freelance consultants spend between **2 to 5 hours per client per month** manually generating client reports. The typical existing workflow involves:
1. Exporting monthly CSV data from Google Search Console (GSC), Google Analytics 4 (GA4), and various rank trackers (SEMrush, Ahrefs, SE Ranking, etc.).
2. Opening spreadsheets to calculate Month-over-Month (MoM) deltas, clicks, impressions, CTR, organic sessions, and ranking changes.
3. Manually creating charts and copying data into Google Slides, Canva, or Word documents.
4. Writing custom commentary ("What happened", "What we did", "Next steps").
5. Manually exporting to PDF or emailing static slides.

Existing automated reporting tools (Looker Studio, DashThis, AgencyAnalytics) suffer from major pain points:
* **OAuth / Access Headaches:** Constantly breaking OAuth tokens, requiring client access permissions, security audits, and Google API quotas.
* **Prohibitive Pricing:** Agency platforms cost upwards of $50–$300/month, pricing out freelancers and local boutique agencies.
* **Over-complexity:** Clients rarely look at 20-page dashboards; they want executive-level insights, key movement highlights, and clear next steps.

---

## 3. Target User Personas

1. **Solo SEO Consultant:** Manages 3–8 clients. Needs clean, professional reports without spending full working days on reporting each month-end.
2. **Local Boutique Agency Owner:** Manages 10–25 small business accounts. Needs consistent agency branding (logo, brand colors) and team efficiency.
3. **Freelance Digital Marketer:** Offers SEO as part of a wider marketing retainer. Needs simple drag-and-drop CSV compiling without complex setup.

---

## 4. Business Objectives & Success Metrics

### Business Objectives
* Launch a rock-solid, privacy-preserving MVP with zero API dependencies.
* Provide an end-to-end report generation turnaround in **under 2 minutes** per client.
* Offer a clear monetization tier: **₹499/month (or $7/month)** for 5 client reports/month, with expansion tiers for growing agencies.

### Success Metrics (KPIs)
* **Time-to-Report:** < 120 seconds from CSV upload to shareable client report.
* **Parsing Success Rate:** > 99.5% on standard GSC, GA4, and generic Rank CSV exports.
* **Zero OAuth Failures:** 100% immune to API deprecation or token expirations.
* **Customer Delight:** High conversion from free trial / initial report to paid subscription.

---

## 5. Scope Boundary (MVP vs. Non-MVP)

### In-Scope (MVP)
* User authentication (email/password, secure sessions).
* Workspace/Client management (Client name, domain, agency branding).
* Multi-source CSV Upload & Safe Parsing (GSC, GA4, Keyword Rank exports).
* Schema validation & data normalization engine.
* Automated KPI calculations & MoM comparisons (Clicks, Impressions, CTR, Avg Position, Sessions, Top Gainers/Losers).
* Rich, structured commentary editor ("What happened", "What we did", "What's next").
* Agency White-Label Branding (Agency name, logo, custom accent color).
* Read-only, secure, shareable public client links (`/r/{shareId}`).
* High-fidelity Browser Print & Clean PDF generation.
* Razorpay payment gateway integration for subscription/quota management.

### Explicitly Out-of-Scope (Non-MVP)
* Google OAuth / Direct Google APIs.
* Web scrapers or live crawler infrastructure.
* AI-generated hallucinated text (all commentary is consultant-authored).
* Multi-channel social/ad integrations (Meta Ads, Google Ads).
* Complex real-time rank tracking bots.

---

## 6. Business Risk Assessment & Mitigation

| Risk Category | Identified Risk | Impact | Mitigation Strategy |
|---|---|---|---|
| **Technical** | CSV format variations across different tools and locales | High | Robust normalization layer with fuzzy header detection and schema validation fallbacks. |
| **Security** | Formula injection / CSV injection in exports | High | Strict cell sanitization, stripping leading `=`, `+`, `-`, `@`, `\t`, `\r` prefixes. |
| **Security** | IDOR / Unauthorized access to private client reports | Critical | Strict workspace ownership checks in D1 database and unguessable 128-bit public share tokens. |
| **Financial** | Client-side payment spoofing | Critical | Server-side Razorpay webhook and HMAC-SHA256 signature verification. |
| **Operational** | Service downtime on serverless backend | Low | Cloudflare edge deployment with multi-region D1 replication and static asset caching. |

---
