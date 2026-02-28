# CLRHOA.COM HOA PORTAL - DEVELOPMENT RULES

## FLORIDA HOA COMPLIANCE (Statute 720.303(4))
MUST HAVE:
- /documents → public: covenants, bylaws, ARB form, proxy (src/public/*.pdf)
- /portal → protected: budgets, redacted minutes, contracts (R2 + auth)

NEVER PUBLIC:
- Meeting minutes with PII
- Individual assessment balances
- Contracts with pricing details

## TECH CONSTRAINTS
Astro 4.x + @astrojs/cloudflare SSR adapter
Cloudflare FREE TIER ONLY: Pages, D1 (clrhoa_db), R2 (clrhoa-files), KV (3 namespaces)
Tailwind CSS mobile-first
TypeScript everywhere
Sharp.js for images (5MB→800KB auto-resize)
NO paid services, NO external CMS

## AUTHENTICATION
Password-based auth with Lucia v3 session management
- Users table in D1 (email, password_hash, role, status)
- Password setup flow for new users (email invitation with secure tokens)
- Bcrypt password hashing (cost factor 10)
- HttpOnly session cookies with fingerprinting
- Astro.locals.user = {email, role}
- Session storage in D1, managed by Lucia

Roles: member | board | arb | arb_board | admin
Elevated roles (isElevatedRole): board, arb_board, admin
Use getEffectiveRole(session) — respects admin assumed-role

## FILE STRUCTURE (Preserve Existing)
src/public/*.pdf ← EXISTING public docs (DO NOT TOUCH)
src/pages/documents.astro ← EXISTING public page (DO NOT TOUCH)
src/pages/portal/* → SSR protected routes
src/pages/api/* → API endpoints (all prerender = false)
src/lib/ → shared business logic
src/middleware.ts → auth + session injection for all routes

## CLOUDFLARE BINDINGS (wrangler.toml)
D1:  DB             → clrhoa_db         (main database)
KV:  CLRHOA_USERS   → email whitelist (key=email, value=role string)
KV:  SESSION        → Lucia session storage
KV:  KV             → rate limiting + login lockout
R2:  CLOURHOA_FILES → clrhoa-files bucket  ⚠️ typo in binding name is intentional

Access in SSR: locals.runtime.env.DB / .CLRHOA_USERS / .SESSION / .KV / .CLOURHOA_FILES

## D1 TABLES (IF NOT EXISTS always)
users: id, email, name, password_hash, role, status, created
owners: id, email, name, address, lot_number, phone, phones, board_title, is_primary
arb_requests: id, owner_email, status, esign_timestamp
arb_files: request_id, r2_keys
directory_logs: viewer_email, target_phone, viewer_role, ip_address
vendors: name, category, phone, notes, files, show_on_public
sessions: (Lucia managed)
security_events: id, event_type, severity, user_id, details, created_at
password_reset_tokens: id, user_email, token_hash, ip_address, user_agent, expires_at, used_at

DB migration scripts use: npm run db:phase[N] (remote) / db:phase[N]:local
Always write migrations with ALTER TABLE ... ADD COLUMN IF NOT EXISTS (SQLite compat via try/catch)

## NOTIFICATIONS
ALWAYS use env vars — NO HARDCODED EMAILS:
env.NOTIFY_BOARD_EMAIL → production: "board@clrhoa.com"
env.NOTIFY_ARB_EMAIL   → "arb@clrhoa.com"
Email: Resend (primary), MailChannels (fallback)
SMS: Twilio opt-in

## SECURITY RULES
NO client-side D1/R2/KV access — server only
SSR middleware validates auth on EVERY /portal/* and /admin/* route
Phone reveals → directory_logs audit
Images: original/review/archive tiers in R2
CSP headers enabled
Rate limiting via KV namespace (checkRateLimit from src/lib/rate-limit.ts)
All auth events → logSecurityEvent (src/lib/audit-log.ts)

## PHASE STATUS (all deployed)
Phase 1: Auth + /portal/documents ✓
Phase 2: ARB workflow ✓
Phase 3: Directory + Vendors ✓
Phase 3.5: MailChannels notifications ✓
Phase 4: Meetings + Maintenance ✓
Phase 5: Assessments + Feedback ✓
Phase 5.5: PWA + UX polish ✓
Phase 6: Smart Search + Pre-approval Library ✓

## TESTING
Unit tests: npm test (vitest)
E2E tests:  npm run test:e2e (playwright)
Smoke:      npm run test:smoke
Always run tests before pushing. Fix failures — never skip.

## BEFORE GENERATING CODE
1. Run /phase-context to auto-load relevant existing files
2. Check src/lib/ for existing helpers before writing new ones
3. Mirror auth pattern from existing portal endpoints
4. All new API routes: export const prerender = false

## DEPLOYMENT
Secrets: RESEND_API_KEY, MAILCHANNELS_API_KEY, SESSION_SECRET, TWILIO_*
GitHub Actions → Cloudflare Pages
Local dev: npm run dev (uses .dev.vars for secrets)
Remote dev: wrangler dev --remote
