# Security Assessment & Recommendations

## Current Security Posture: **A (Strong)**

The site uses a **hybrid architecture**: a largely static public site plus a **server-rendered member portal and board area** (Astro on Cloudflare Pages with D1, KV, and R2). Security is enforced at the edge (middleware), in session auth, and in role-based access control.

---

## ✅ Current Strengths

### 1. Architecture & deployment

- **Public pages**: Mostly static or server-rendered with **limited, non-PII data** (see `docs/DATA_ACCESS_CONTROL.md`). No session or secrets on the public side; only `PUBLIC_*` env and safe DB helpers.
- **Portal/board**: Server-rendered with **session-based auth** (signed cookies, HttpOnly, Secure, SameSite=Lax). KV whitelist for who can log in; D1 for data; R2 for files.
- **Cloudflare**: HTTPS, DDoS mitigation, and global edge. Secrets (e.g. `SESSION_SECRET`) set via `wrangler secret put` and not in repo.

### 2. Authentication & session

- **Session cookie**: HMAC-SHA256 signed payload; expiry and optional **inactivity timeout** (30 min). Optional **fingerprint** (user-agent + IP) to reduce hijacking risk.
- **Login**: Rate-limited and **account lockout** after repeated failures (KV). No passwords; Google OAuth or magic-link style flows; access controlled by KV whitelist.
- **CSRF**: Mutating API routes check **origin/referer** and use **CSRF tokens** where appropriate (e.g. ARB actions, preferences, directory updates).

### 3. Authorization & access control

- **Middleware**: `/portal/*` requires a valid session (and profile completeness where needed); `/board/*` requires session **and** elevated role (board, arb, admin, arb_board). Elevated API prefixes return 403 if the user is authenticated but not elevated.
- **Resource ownership**: **`requireArbRequestAccess`** and **`requireArbRequestOwner`** in `src/lib/access-control.ts` centralize ARB request checks (owner or elevated for read; owner only for cancel/add/remove file). Used consistently across ARB APIs.
- **File access**: ARB attachments require request owner or elevated; **member documents** are only served if the key exists in `member_documents` (no arbitrary R2 paths).
- **Data access**: Documented in `docs/DATA_ACCESS_CONTROL.md` (who can see what, audit logging for directory, etc.).

### 4. HTTP security headers (middleware)

- **Content-Security-Policy** (CSP): Restricts scripts, styles, frames, form-action; `frame-ancestors 'none'` (or `'self'` only for file-view iframe).
- **Strict-Transport-Security** (HSTS): Enabled on HTTPS responses.
- **X-Content-Type-Options**: nosniff.
- **X-Frame-Options**: DENY (or SAMEORIGIN for file-view).
- **Referrer-Policy**: strict-origin-when-cross-origin.
- **Permissions-Policy**: geolocation, microphone, camera disabled.
- **X-XSS-Protection**: 1; mode=block (legacy; CSP is primary).

### 5. Input & output safety

- **Sanitization**: `src/lib/sanitize.ts` (escapeHtml, sanitizeFileName, sanitizeEmail, sanitizeForScriptInjection, etc.). User-generated content is sanitized for display.
- **Path traversal**: Rejected in file keys (e.g. `..` in path). Member-doc keys validated against DB before serve.
- **SQL**: Parameterized queries via D1 prepared statements (no raw concatenation).

### 6. Rate limiting & abuse prevention

- **API rate limits** (KV): Login, ARB upload/cancel/approve/notes, directory reveal, CSV upload, etc. Per-IP and per-endpoint; 429 when exceeded. See `docs/RATE_LIMITING.md`.
- **Login lockout**: Failed attempts tracked in KV; temporary lockout after threshold.
- **Contact form**: StaticForms with honeypot and optional reCAPTCHA (no app-side rate limit; third-party handles submission).

### 7. Security files & disclosure

- **robots.txt**: Served from `src/pages/robots.txt.ts` (configurable disallow/sitemap).
- **security.txt**: At `/.well-known/security.txt` (Contact, Expires, Policy, Acknowledgments) for responsible disclosure.
- **Dependabot**: Enabled (`.github/dependabot.yml`) for dependency alerts and update PRs.

### 8. Privacy & compliance

- **PII**: Public pages do not expose member PII. Portal/board show only what’s needed for the role; directory access is logged.
- **Analytics**: Opt-in, privacy-friendly (e.g. Cloudflare Web Analytics); no cookies without consent where applicable.
- **Env**: Secrets live in runtime env (Cloudflare); only `PUBLIC_*` and `SITE` are used in client-facing code. `env.d.ts` documents Env and public vars.

---

## ⚠️ Areas for Improvement

### 1. Monitoring & incident response (medium)

- **Security monitoring**: Document runbooks for “suspicious logins,” “spike in 4xx/5xx,” “dependency CVE.” See `SECURITY_MONITORING.md` and extend with concrete steps.
- **Incident response**: Short plan (who to contact, how to revoke sessions, how to rotate secrets, how to restore from backup). Can live in `SECURITY_MONITORING.md` or a dedicated `INCIDENT_RESPONSE.md`.

### 2. Dependency & audit cadence (low)

- **npm audit**: Run regularly (e.g. in CI or before release). Document in `DEPENDENCY_SECURITY.md` (“run `npm run audit` before each release”).
- **Update policy**: Define when to apply Dependabot PRs (e.g. security within 48h; minors monthly).

### 3. Optional hardening (low)

- **Security policy page**: `security.txt` references `Policy: https://clrhoa.com/security-policy`. Ensure that URL exists and describes how security issues are handled.
- **SRI**: External scripts (e.g. reCAPTCHA, Cloudflare beacon) already considered in CSP; SRI hashes (see `SRI.md`) add another layer if you want to lock script integrity further.

---

## Risk Overview

| Area              | Status   | Notes                                                    |
|-------------------|----------|----------------------------------------------------------|
| Auth/session      | Strong   | Signed cookies, optional fingerprint, lockout, rate limit |
| Authorization     | Strong   | Middleware + access-control helpers; documented          |
| Headers / CSP     | Strong   | Set in middleware; HSTS on HTTPS                         |
| Input sanitization| Good     | Centralized sanitize lib; parameterized DB               |
| Rate limiting     | Good     | Login, ARB, directory, CSV; see RATE_LIMITING.md          |
| Public data       | Good     | No PII; limited public DB helpers                        |
| Dependencies      | Good     | Dependabot; could add audit in CI                        |
| Monitoring/IR     | Improve  | Document runbooks and incident steps                     |

---

## Compliance & standards

- **GDPR**: Privacy-friendly analytics; no unnecessary PII on public site; access and logging documented.
- **Security.txt**: Present for coordinated disclosure (RFC 9116).

---

## Next steps

1. **Document** incident response and security monitoring runbooks (e.g. in `SECURITY_MONITORING.md`).
2. **Add** `npm run audit` to CI or release checklist; document in `DEPENDENCY_SECURITY.md`.
3. **Confirm** `/security-policy` (and `/security-acknowledgments` if used) exist and match `security.txt`.

For header details see `SECURITY_HEADERS.md`; for data and access rules see `DATA_ACCESS_CONTROL.md`; for rate limits see `RATE_LIMITING.md`.
