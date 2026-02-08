# Architecture Overview

High-level structure of the Crooked Lake Reserve HOA site: public pages, member portal, and board area.

## Three zones

| Zone | Paths | Auth | Data |
|------|--------|------|------|
| **Public** | `/`, `/about`, `/contact`, `/documents`, `/news`, `/resources/*`, `/dues`, etc. | None | Only `PUBLIC_*` env and safe DB helpers (e.g. `listMeetingsForPublicNews`, `listPublicVendors`, `listPublicDocuments`). No session or secrets. |
| **Portal** | `/portal/*` (except `/portal/login`) | Session required (middleware). Profile completeness required before other portal pages. | D1, R2, KV via `Astro.locals.runtime.env`. Data scoped by `session.email` (or primary owner at address for assessments). |
| **Board** | `/board/*`, elevated APIs | Session + elevated role (board, arb, admin, arb_board). Middleware redirects non-elevated to `/portal/dashboard`. | Same bindings; full access to directory, ARB, meetings, assessments, etc. |

## Auth flow

1. **Login**: User hits `/portal/login`; credentials (e.g. Google OAuth or magic link) are validated. If the email is in KV whitelist (`CLOURHOA_USERS`), a **signed session cookie** is set (HMAC-SHA256, HttpOnly, Secure, SameSite=Lax).
2. **Middleware** (runs on every request): For `/portal/*` (except login), checks for session cookie; if missing, redirects to login. For `/board/*`, also checks elevated role. For profile completeness, redirects to `/portal/profile?required=1` if name/address/phone missing.
3. **APIs**: Protected APIs use `requireSession(Astro)` (from `api-helpers`) or manual `getSessionFromCookie`; then role or ownership checks as needed (e.g. `requireArbRequestOwner` in `access-control`).

## Key libraries

- **`src/lib/auth.ts`** — Session (sign/verify), KV whitelist, CSRF, origin check, login lockout.
- **`src/lib/api-helpers.ts`** — `jsonResponse`, `requireSession`, `requireDb` for API routes.
- **`src/lib/portal-context.ts`** — `getPortalContext(Astro)` for portal pages (env + session, optional fingerprint).
- **`src/lib/board-context.ts`** — `getBoardContext(Astro)` for board pages: returns `{ env, session }` or a redirect URL so the page can call `Astro.redirect()`. Ensures session exists and role is elevated (board, admin, arb, arb_board). Pages that need a stricter role (e.g. board-only) check `session.role` after.
- **`src/lib/access-control.ts`** — `requireArbRequestAccess`, `requireArbRequestOwner` for ARB resource checks.
- **`src/lib/rate-limit.ts`** — Per-IP rate limits (KV); config per endpoint.
- **`src/lib/sanitize.ts`** — Escape/sanitize for display and file names.
- **`src/middleware.ts`** — Auth gates and security headers (CSP, HSTS, etc.).

## Data stores

- **D1** — SQLite (users, owners, arb_requests, meetings, assessments, feedback, member_documents, public_documents, directory_logs, etc.).
- **KV** — `CLOURHOA_USERS` (login whitelist + role); `KV` (rate limiting, login lockout).
- **R2** — `CLOURHOA_FILES` (ARB attachments, member docs, feedback PDFs, public doc overrides, etc.).

## Build and deploy

- **Astro** with `output: 'static'` and **Cloudflare** adapter. Pages with `prerender: false` are server-rendered at runtime (portal/board and some API-backed public pages).
- **Deploy**: Cloudflare Pages; bindings (D1, KV, R2) and secrets configured in the dashboard or via `wrangler secret put`.

For data and access rules see **DATA_ACCESS_CONTROL.md**. For security see **SECURITY.md** and **SECURITY_ASSESSMENT.md**.
