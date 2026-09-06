# ReportDrop — Database Architecture & D1 Relational Schema

**Document Version:** 1.0.0  
**Status:** Approved  
**Author:** Principal Database Architect & Backend Engineer  
**Date:** September 2026  

---

## 1. Relational Entity Relationship Diagram (ERD)

```text
       ┌────────────────────────┐
       │         users          │
       ├────────────────────────┤
       │ id (PK, TEXT)          │
       │ email (TEXT, UNIQUE)   │
       │ password_hash (TEXT)   │
       │ password_salt (TEXT)   │
       │ full_name (TEXT)       │
       │ agency_name (TEXT)     │
       │ agency_logo (TEXT)     │
       │ accent_color (TEXT)    │
       │ plan (TEXT)            │ ◄── 'free' | 'pro'
       │ subscription_status    │ ◄── 'active' | 'inactive' | 'past_due'
       │ created_at (INTEGER)   │
       │ updated_at (INTEGER)   │
       └───────────┬────────────┘
                   │ 1
                   │
                   │ N
       ┌───────────▼────────────┐
       │       workspaces       │
       ├────────────────────────┤
       │ id (PK, TEXT)          │
       │ user_id (FK -> users)  │
       │ client_name (TEXT)     │
       │ client_domain (TEXT)   │
       │ currency (TEXT)        │
       │ created_at (INTEGER)   │
       │ updated_at (INTEGER)   │
       └───────────┬────────────┘
                   │ 1
                   │
                   │ N
       ┌───────────▼────────────┐
       │        reports         │
       ├────────────────────────┤
       │ id (PK, TEXT)          │
       │ workspace_id (FK)      │
       │ user_id (FK -> users)  │ ◄── Denormalized for rapid authorization
       │ report_title (TEXT)    │
       │ reporting_period(TEXT) │ ◄── e.g. '2026-08' or 'August 2026'
       │ share_token (UNIQUE)   │ ◄── Unguessable 128-bit hex string for public access
       │ is_public (INTEGER)    │ ◄── 1 = Publicly viewable, 0 = Private
       │ data_json (TEXT)       │ ◄── Normalized ReportData JSON (KPIs, queries, pages, keywords)
       │ commentary_json (TEXT) │ ◄── What happened / What we did / What's next
       │ branding_json (TEXT)   │ ◄── Agency name, logo URL/data, accent color
       │ status (TEXT)          │ ◄── 'draft' | 'published'
       │ created_at (INTEGER)   │
       │ updated_at (INTEGER)   │
       └────────────────────────┘

       ┌────────────────────────┐
       │     subscriptions      │
       ├────────────────────────┤
       │ id (PK, TEXT)          │
       │ user_id (FK -> users)  │
       │ razorpay_order_id      │
       │ razorpay_payment_id    │
       │ razorpay_sub_id        │
       │ plan (TEXT)            │
       │ amount (INTEGER)       │
       │ currency (TEXT)        │
       │ status (TEXT)          │ ◄── 'created' | 'paid' | 'failed'
       │ signature (TEXT)       │
       │ current_period_end     │
       │ created_at (INTEGER)   │
       │ updated_at (INTEGER)   │
       └────────────────────────┘

       ┌────────────────────────┐
       │     audit_events       │
       ├────────────────────────┤
       │ id (PK, TEXT)          │
       │ user_id (TEXT, NULL)   │
       │ action (TEXT)          │ ◄── 'auth.login', 'report.created', 'payment.verified'
       │ resource_type (TEXT)   │
       │ resource_id (TEXT)     │
       │ ip_address (TEXT)      │
       │ user_agent (TEXT)      │
       │ metadata_json (TEXT)   │
       │ created_at (INTEGER)   │
       └────────────────────────┘
```

---

## 2. Table Specifications & Indexing Strategy

### `users` Table
Stores user credentials, profile settings, agency branding defaults, and plan status.
* **Indexes:**
  * `idx_users_email` ON `users(email)` (UNIQUE)

### `workspaces` Table
Stores client projects owned by a user.
* **Indexes:**
  * `idx_workspaces_user_id` ON `workspaces(user_id)`

### `reports` Table
Stores compiled monthly reports, normalized JSON payloads, commentary, and public share tokens.
* **Indexes:**
  * `idx_reports_user_id` ON `reports(user_id)`
  * `idx_reports_workspace_id` ON `reports(workspace_id)`
  * `idx_reports_share_token` ON `reports(share_token)` (UNIQUE)

### `subscriptions` Table
Stores Razorpay payment transaction records and entitlement verification logs.
* **Indexes:**
  * `idx_subscriptions_user_id` ON `subscriptions(user_id)`
  * `idx_subscriptions_order_id` ON `subscriptions(razorpay_order_id)`

### `audit_events` Table
Stores immutable security and operational audit logs.
* **Indexes:**
  * `idx_audit_events_user_id` ON `audit_events(user_id)`
  * `idx_audit_events_created_at` ON `audit_events(created_at)`

---

## 3. Data Lifecycle & Ownership Security

1. **Strict Ownership Hierarchy:** Every query modifying a workspace or report MUST include `WHERE user_id = ?` derived from the verified session token, completely preventing IDOR / BOLA vulnerabilities.
2. **Public Report Isolation:** Public report access (`/api/public/reports/:shareToken`) strictly selects `report_title, reporting_period, data_json, commentary_json, branding_json, is_public` WHERE `share_token = ? AND is_public = 1`. It never exposes user account details, workspace IDs, or internal user emails.
3. **Soft/Hard Deletion:** Deleting a workspace cascades to its reports or prevents orphaned records via SQLite foreign keys.

---
