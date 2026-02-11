# CLRHOA.COM HOA PORTAL - DEVELOPMENT RULES

## FLORIDA HOA COMPLIANCE (Statute 720.303(4))
MUST HAVE (Phase 1):
- /documents → public: covenants, bylaws, ARB form, proxy (src/public/*.pdf)
- /portal → protected: budgets, redacted minutes, contracts (R2 + auth)

NEVER PUBLIC:
- Meeting minutes with PII
- Individual assessment balances
- Contracts with pricing details

## TECH CONSTRAINTS
Astro 4.x + @astrojs/cloudflare SSR adapter
Cloudflare FREE TIER ONLY: Pages, D1 (clrhoa_db), R2 (clrhoa_files), KV (clrhoa_users)
Tailwind CSS mobile-first
TypeScript everywhere
Sharp.js for images (5MB→800KB auto-resize)
NO paid services, NO external CMS

## AUTHENTICATION (Phase 1)
Email whitelist only (NO passwords) - working on implementing
- KV clrhoa_users → {email: {role: "member|arb|board", name: "..."}}
- HttpOnly session cookie
- Astro.locals.user = {email, role}

## FILE STRUCTURE (Preserve Existing)
src/public/*.pdf ← EXISTING public docs (DO NOT TOUCH)
src/pages/documents.astro ← EXISTING public page (DO NOT TOUCH)
NEW: /portal/* → SSR protected routes only

## D1 TABLES (IF NOT EXISTS)
users: email, role, name, phone, sms_optin
arb_requests: id, owner_email, status, esign_timestamp
arb_files: request_id, r2_keys
owners: name, address, phone, email
directory_logs: viewer_email, target_phone
vendors: name, category, phone, notes, files

## NOTIFICATIONS (Phase 3.5)
ALWAYS use env vars - NO HARDCODED EMAILS:
env.NOTIFY_BOARD_EMAIL = "testing@gmail.com" → production: "board@clrhoa.com"
env.NOTIFY_ARB_EMAIL = "arb@clrhoa.com"
MailChannels binding + Twilio SMS opt-in

## SECURITY RULES
NO client-side D1/R2 access
SSR middleware EVERY /portal/* route
Phone reveals → directory_logs audit
Images: original/review/archive tiers in R2
CSP headers enabled

## PHASE ORDER (Incremental Deploy)
Phase 1: Auth + /portal/documents
Phase 2: ARB workflow
Phase 3: Directory + Vendors
Phase 3.5: MailChannels notifications
Phase 4: Meetings + Maintenance
Phase 5: Assessments + Feedback
Phase 5.5: PWA + UX polish
Phase 6: Smart Search + Pre-approval Library

## BEFORE GENERATING CODE
ALWAYS ASK: "Which phase are we extending? Show me existing auth/db/notifications first."

## DEPLOYMENT
wrangler.toml bindings: D1 clrhoa_db, R2 clrhoa_files, KV clrhoa_users, MAILCHANNELS
GitHub Actions → Cloudflare Pages
Test local: npm run dev → wrangler dev --remote
