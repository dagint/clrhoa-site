# Security Verification Checklist

Use this checklist to verify security posture after changes or on a regular cadence (e.g. quarterly).

## Headers & public endpoints

- [ ] Run [securityheaders.com](https://securityheaders.com) (or similar) against `https://clrhoa.com`; confirm A or A+.
- [ ] Confirm `/.well-known/security.txt` returns 200 and shows Contact, Expires, Canonical.
- [ ] Confirm `/robots.txt` returns 200 and reflects intended crawl rules.
- [ ] Confirm HTTPS and HSTS: `curl -I https://clrhoa.com` shows `Strict-Transport-Security`.

## Auth & access

- [ ] Unauthenticated access to `/portal/*` (except login) redirects to login.
- [ ] Unauthenticated access to `/board/*` redirects to login; non-elevated users redirect to dashboard.
- [ ] API routes that require session return 401 without a valid session cookie.
- [ ] Elevated-only APIs return 403 for authenticated non-elevated users.
- [ ] ARB file URLs for another user’s request return 403 (unless elevated).

## Data & env

- [ ] Public pages do not use `runtime.env` or session; only `PUBLIC_*` or `SITE` from env.
- [ ] No secrets in client bundles; `SESSION_SECRET`, DB, KV, R2, and API keys are server-only.
- [ ] `npm run audit` shows no critical/high vulnerabilities (or they are documented and accepted).

## Dependencies & repo

- [ ] Dependabot (or equivalent) is enabled; security PRs are reviewed and merged on a defined cadence.
- [ ] `.env` and `.dev.vars` (and any files with secrets) are in `.gitignore` and not committed.
- [ ] `docs/SECURITY_ASSESSMENT.md` and `docs/DATA_ACCESS_CONTROL.md` are up to date after architectural changes.

## After deployment

- [ ] Cloudflare env (Pages / Workers) has `SESSION_SECRET` and required bindings (DB, KV, R2) set.
- [ ] Rate limiting KV is attached in production if rate limits are desired (see `RATE_LIMITING.md`).

---

**Reference**: Full security docs in `SECURITY.md`, `SECURITY_ASSESSMENT.md`, `SECURITY_SUMMARY.md`, and `DATA_ACCESS_CONTROL.md`.
