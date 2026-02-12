# D1 database migrations

Run migrations **in this order**. For local dev (before `npm run dev`), use the **:local** commands or run **one** of the “all” scripts below.

---

## One-command setup

| Environment | Command |
|-------------|---------|
| **Local** (for `npm run dev`) | `npm run db:local:all` |
| **Remote** (production/staging) | `npm run db:remote:all` |

These run every migration in the correct order. Use them when bringing a new DB up to date.

---

## All commands in dependency order

### Base + ARB

| Step | Local | Remote |
|------|--------|--------|
| 1 | `npm run db:init:local` | `npm run db:init` |
| 2 | `npm run db:arb:init:local` | `npm run db:arb:init` |
| 3 | `npm run db:arb:migrate:local` | `npm run db:arb:migrate` |
| 4 | `npm run db:arb:migrate-v3:local` | `npm run db:arb:migrate-v3` |
| 5 | `npm run db:arb:migrate-v4:local` | `npm run db:arb:migrate-v4` |
| 6 | `npm run db:arb:migrate-v5:local` | `npm run db:arb:migrate-v5` |
| 7 | `npm run db:arb:migrate-v6:local` | `npm run db:arb:migrate-v6` |
| 8 | `npm run db:arb:migrate-v7:local` | `npm run db:arb:migrate-v7` |
| 9 | `npm run db:arb:migrate-v8:local` | `npm run db:arb:migrate-v8` |
| 10 | `npm run db:arb:audit:local` | `npm run db:arb:audit` |

### Phase 3 (directory, vendors)

| Step | Local | Remote |
|------|--------|--------|
| 11 | `npm run db:phase3:local` | `npm run db:phase3` |
| 12 | `npm run db:vendor-submissions:local` | `npm run db:vendor-submissions` |
| 13 | `npm run db:owners-phones:local` | `npm run db:owners-phones` |
| 14 | `npm run db:vendors-website:local` | `npm run db:vendors-website` |
| 15 | `npm run db:vendor-submissions-website:local` | `npm run db:vendor-submissions-website` |
| 16 | `npm run db:directory-logs-email:local` | `npm run db:directory-logs-email` |
| 17 | `npm run db:directory-logs-viewer-role:local` | `npm run db:directory-logs-viewer-role` |
| 18 | `npm run db:owners-audit-contact:local` | `npm run db:owners-audit-contact` |
| 19 | `npm run db:owners-created-at:local` | `npm run db:owners-created-at` |

### Phase 4 (meetings, maintenance)

| Step | Local | Remote |
|------|--------|--------|
| 20 | `npm run db:phase4:local` | `npm run db:phase4` |

### Phase 3.5 (user notifications)

| Step | Local | Remote |
|------|--------|--------|
| 21 | `npm run db:phase35:local` | `npm run db:phase35` |
| 22 | `npm run db:phase35-notification-types:local` | `npm run db:phase35-notification-types` |

### Phase 5 (assessments, feedback)

| Step | Local | Remote |
|------|--------|--------|
| 23 | `npm run db:phase5:local` | `npm run db:phase5` |
| 24 | `npm run db:phase5-paid-through:local` | `npm run db:phase5-paid-through` |
| 24b | `npm run db:phase5-special-assessments:local` | `npm run db:phase5-special-assessments` |

### Phase 6 + login history + member documents

| Step | Local | Remote |
|------|--------|--------|
| 25 | `npm run db:phase6:local` | `npm run db:phase6` |
| 26 | `npm run db:login-history:local` | `npm run db:login-history` |
| 27 | `npm run db:public-documents:local` | `npm run db:public-documents` |
| 28 | `npm run db:member-documents:local` | `npm run db:member-documents` |
| 29 | `npm run db:backup-config:local` | `npm run db:backup-config` |
| 30 | `npm run db:assessment-recorded-by:local` | `npm run db:assessment-recorded-by` |
| 31 | `npm run db:admin-assumed-role:local` | `npm run db:admin-assumed-role` |
| 32 | `npm run db:admin-assumed-role-actor:local` | `npm run db:admin-assumed-role-actor` |

Step 31 creates the `admin_assumed_role_audit` table (admins and arb_board assume Board or ARB, one at a time; all assume/clear and actions-while-assumed are logged). Step 32 adds the `actor_role` column (admin vs arb_board). If the table already existed without it, run step 32.

---

## Before `npm run dev`

From the project root, run:

```bash
npm run db:local:all
```

Then:

```bash
npm run dev
```

If a migration fails (e.g. “table already exists”), that’s usually safe to ignore for that step; continue with the next or re-run `db:local:all` to ensure the rest are applied.
