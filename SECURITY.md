# Security

This document summarizes how the site enforces **elevated access** and mitigates **injection**, **XSS**, and **SSRF**.

---

## Elevated access (members cannot access elevated APIs/pages)

- **Definition of elevated:** ARB, Board, ARB+Board, Admin. See `ELEVATED_ROLES` and `isElevatedRole()` in `src/lib/auth.ts`.
- **Middleware** (`src/middleware.ts`): Only enforces **portal** auth (session cookie and profile completeness for `/portal/*`). It does **not** gate `/board/*` or elevated APIs; those rely on per-request checks.
- **Enforcement is per-request:**
  - **Board pages** (`src/pages/board/*`): Each page checks `session.role` (e.g. `isBoard` or `allowedRoles.includes(session.role)`) and redirects to `/portal/dashboard` if the user is not allowed.
  - **Elevated APIs:** Each elevated endpoint checks session and role before performing the action and returns `401`/`403` otherwise.

### Elevated API checklist (role checked before acting)

| Area | Role check | Notes |
|------|------------|--------|
| `GET/POST/PUT/DELETE /api/owners` | `canManageDirectory` / `isBoard` | Board+ARB for directory; board-only for role changes and delete. |
| `POST /api/owners/upload-csv` | `canManageDirectory` | Board, Admin, ARB, ARB+Board. |
| `GET/POST/DELETE /api/meetings`, `POST meeting-agenda-upload` | `isBoard` | Board, Admin, ARB+Board. |
| `GET/POST/PUT/DELETE /api/feedback`, `POST feedback-upload` | `isBoard` for write/export | Members can submit/read own; board for all/export. |
| `GET/POST/PUT/DELETE /api/vendors` | `isBoard` for write | Members read; board for mutations. |
| `GET/POST /api/vendor-submissions` | `isReviewer` for admin actions | Role-scoped. |
| `POST /api/arb-approve`, `arb-notes`, `arb-deadline` | `allowedRoles` (ARB/Board/Admin/ARB+Board) | CSRF and origin verified. |
| `GET /api/arb-download-zip` | Owner **or** `allowedRoles` | IDOR-safe: owner or elevated. |
| `GET /api/arb-export-data` | Owner only (by session.email) | No elevated-only; member exports own data. |
| `POST /api/maintenance-update` | `isBoard` | Board-only. |
| `GET /api/preapproval` (sensitive data) | `isReviewer` | Elevated can see more. |
| `POST /api/log-phone-view` | Any authenticated; opt-out and `viewer_role` logged | Elevated can bypass opt-out; audit in place. |

### Best practices to keep members out of elevated paths

1. **Never trust the client:** Role is read from the **server-side session** (cookie verified with `SESSION_SECRET`), not from request body or query.
2. **Every elevated route must check role:** When adding a new board/ARB-only page or API, add a session + role check at the top and return 403 or redirect.
3. **IDOR:** For actions keyed by ID (e.g. request id, owner id), ensure the user is either the **owner** of that resource or has an **elevated role** before allowing the action. See e.g. `arb-download-zip` (owner or allowed roles) and `arb-approve` (elevated only, request exists).
4. **Optional hardening:** Add middleware that redirects non-elevated users away from `/board/*` and optionally returns 403 for known elevated API path prefixes, so that a single place enforces “no member on board routes” in addition to per-request checks.

---

## Injection (SQL / NoSQL)

- **D1 (SQL):** All queries use **parameterized statements** (`prepare()` + `bind()`). User or request-derived values are passed as bound parameters, not concatenated into SQL. See `src/lib/arb-db.ts`, `src/lib/directory-db.ts`, `src/lib/meetings-db.ts`, `src/lib/assessments-db.ts`, etc.
- **KV/R2:** Keys and values are either fixed, derived from validated/sanitized input (e.g. email, request id), or server-generated. No raw user input is used as key paths without validation.

---

## XSS (Cross-site scripting)

- **CSP:** Middleware sets a strict **Content-Security-Policy** (e.g. `default-src 'self'`, script/style/frame restrictions). See `src/middleware.ts`.
- **Headers:** `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `X-Frame-Options`, etc.
- **Output:** User-derived content shown in HTML is passed through **`sanitizeForDisplay()`** (or equivalent) from `src/lib/sanitize.ts` (strip tags, escape `&<>"'`). Used in my-requests, directory listings, ARB dashboard cards, etc.
- **Script context:** `sanitizeForScriptInjection()` is used for data passed into `define:vars` / inlined script to avoid breaking out of script tags.
- **Avoid raw HTML:** Prefer text or sanitized output; where `set:html` or `innerHTML` is used, the value must be sanitized or be known-safe (e.g. static strings or `JSON.stringify` of structured data). API-driven content in `innerHTML` (e.g. directory reveal placeholders) should be escaped (e.g. `escapeHtml`) for defense in depth.

---

## SSRF (Server-side request forgery)

- **Outbound `fetch`:** Used for Resend, MailChannels, and Twilio. URLs and hosts come from **configuration or trusted constants**, not from user-controlled input.
- **Redirects:** Login/post-login redirects use server-controlled URLs (e.g. `/portal/dashboard` or validated `destination`), not user-supplied URLs.
- **Client-side `fetch`:** In the browser, `fetch` is to same-origin API routes or to allowlisted endpoints (e.g. reCAPTCHA); the app does not pass user-controlled URLs to `fetch` on the client for outbound SSRF. File download URLs are built server-side from R2 keys and are same-origin (`/api/portal/file/...`).

---

## File access (R2 / attachment URLs)

- **`/api/portal/file/[...key]`:** Serves R2 objects by key. Access is restricted to:
  - Keys under the allowed prefix (e.g. `arb/`) so arbitrary bucket paths cannot be requested.
  - Authorization: the requesting user must be the **owner** of the ARB request that the key belongs to, or have an **elevated role** (see `src/pages/api/portal/file/[...key].astro`). This prevents IDOR (e.g. a member guessing another member’s attachment key).
- **`/api/portal/file-view`:** Only allows keys under `arb/` and is used for same-origin iframe preview; file content is still served via the file endpoint above with the same auth.

---

## Quick reference

| Threat        | Mitigation |
|---------------|------------|
| Member hits elevated API | Session + role check on every elevated endpoint; 403 if not allowed. |
| Member hits board page    | Page-level redirect to `/portal/dashboard` if not board/ARB/admin. |
| IDOR on request/owner     | Check owner_email or elevated role before acting on resource. |
| SQL injection            | Parameterized queries only (prepare + bind). |
| XSS                        | CSP, sanitizeForDisplay/escapeHtml for user content, no raw user input in set:html/innerHTML. |
| SSRF                       | No user-controlled URLs in server-side fetch or redirects. |
| File IDOR                 | Restrict R2 key prefix and verify request ownership or elevated role for `/api/portal/file/[...key]`. |
