# Prioritized TODO

## Done

- **Request Tabs** — Tabbed requests on `/portal/requests`: All | Pending | In review | Approved | Rejected | Cancelled (ARB status). Red badge for non-final, detail + timeline, SSE live updates.
- **PIM Elevation** — Request elevated access (2 hr TTL), drop anytime. Logged in `pim_elevation_log`. Board Audit has “PIM: elevated access requests” section. Read-only `/portal/elevation-audit` for elevated-whitelist users (no elevation required).
- **Directory Lot Number** — `lot_number` in D1 (1–25). Profile, board directory, portal directory, CSV upload. Required for elevated role. Board directory shows lot# → address mapping.
- **Feedback Collector** — `FeedbackWidget` (bottom-right thumbs + 140-char comment). `/api/site-feedback` (rate limit 3/day). D1 `site_feedback`. Admin `/admin/feedback` with filters and CSV export.
- **SMS (Disabled + Request Tracking)** — Profile: “Request SMS (costs HOA money)” button; no sending. D1 `sms_feature_requests` by lot_number. Admin `/admin/sms-requests`: “X users want SMS”, report for planning.
- **Usage Metrics Dashboard** — `/dashboard`: public daily/weekly views + unique sessions (Chart.js). Admin section: user_id → path → timestamp. `/api/usage/record` beacon, `/api/usage/stats`, `/api/usage/admin`. D1 `page_views`.
- **Dark Mode Fixes** — theme.css: `--text-primary-dark` / `--text-muted-dark`; all `select`s in dark get 4.5:1 (color + bg); `text-gray-400` override; inputs/textareas; Tailwind `text-portal-primary-dark` / `portal-muted-dark`.

---

## Outstanding

### 0. Paging / scalability (optional, as lists grow)
Already paged: **Board audit logs**, **Portal My activity** (directory + ARB), **Profile login activity** (with per-page dropdown 10/25/50/100). Consider adding the same pattern elsewhere if lists get large: **Board** — directory (owners), news, library (preapproval), maintenance, meetings, feedback, member documents, vendors; **Portal** — library (approved items), news; **Admin** — feedback, sms-requests; **Portal** — elevation-audit (PIM log).

### 1. Auth + MFA + Password Management ⭐⭐⭐⭐
Full auth: email/pass login/register. JWT 15min sliding. MFA TOTP toggle (encrypted KV). Roles user/elevated/admin. Admins only assign admins. Password update/reset/forgot with rate limiting. Lucia. Protect admin routes.

Medium-Priority Improvements
  #: 11
  Recommendation: Extract reusable FormField component - form patterns are duplicated across contact, ARB, profile
    pages
  Impact: Code quality
  ────────────────────────────────────────
  #: 12
  Recommendation: Consolidate navigation link definitions into a config file instead of repeating across
  BaseLayout,
     BoardNav, PortalNav
  Impact: Maintainability
  ────────────────────────────────────────
  #: 13
  Recommendation: Add a staging/preview environment - currently only production deploy exists
  Impact: DevOps
  ────────────────────────────────────────
  #: 14
  Recommendation: Implement service worker caching - PWA manifest exists but no offline strategy
  Impact: UX
  ────────────────────────────────────────
  #: 15
  Recommendation: Server-side image resizing - Sharp is a devDep but not used on uploads
  Impact: Performance
  ────────────────────────────────────────
  #: 16
  Recommendation: Granularize elevated role checks - some endpoints treat all elevated roles the same (ARB
  shouldn't
     have Board-level feedback control)
  Impact: Security
  ────────────────────────────────────────
  #: 17
  Recommendation: Add request correlation IDs for log tracing across middleware/API/DB
  Impact: Observability
  ────────────────────────────────────────
  #: 18
  Recommendation: Replace simple hash fingerprinting with crypto.subtle.digest
  Impact: Security
  ────────────────────────────────────────
  #: 19
  Recommendation: Add meta http-equiv redirect fallback cleanup - ProtectedPage uses archaic meta refresh
  Impact: Code quality
  ────────────────────────────────────────
  #: 20
  Recommendation: Document the security model - the auth/RBAC/PIM system is sophisticated and deserves written docs
  Impact: Maintainability
