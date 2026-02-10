# Portal Route Map & RBAC Configuration

Complete mapping of all portal routes, their allowed roles, and route guards.

## Route Structure

### Member Routes (Baseline Access)

| Route | File | Allowed Roles | Route Guard | Description |
|-------|------|---------------|-------------|-------------|
| `/portal/dashboard` | `src/pages/portal/dashboard.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Member home dashboard |
| `/portal/directory` | `src/pages/portal/directory.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Member directory view |
| `/portal/documents` | `src/pages/portal/documents.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Member documents |
| `/portal/profile` | `src/pages/portal/profile.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | User profile management |
| `/portal/requests` | `src/pages/portal/requests.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Member requests |
| `/portal/my-requests` | `src/pages/portal/my-requests.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | User's ARB requests |
| `/portal/maintenance` | `src/pages/portal/maintenance.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Maintenance requests |
| `/portal/meetings` | `src/pages/portal/meetings.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Public meetings |
| `/portal/vendors` | `src/pages/portal/vendors.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Vendor directory |
| `/portal/library` | `src/pages/portal/library.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Pre-approval library |
| `/portal/assessments` | `src/pages/portal/assessments.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Dues/assessments |
| `/portal/arb-request` | `src/pages/portal/arb-request.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Create ARB request |
| `/portal/news` | `src/pages/portal/news.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | News & announcements |
| `/portal/docs` | `src/pages/portal/docs.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Documentation |
| `/portal/faq` | `src/pages/portal/faq.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | FAQ |
| `/portal/my-activity` | `src/pages/portal/my-activity.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | User activity log |
| `/portal/search` | `src/pages/portal/search.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Portal search |
| `/portal/preferences` | `src/pages/portal/preferences.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | User preferences |
| `/portal/feedback` | `src/pages/portal/feedback.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Site feedback widget |

### Admin Routes (Elevated Access)

| Route | File | Allowed Roles | Route Guard | Description |
|-------|------|---------------|-------------|-------------|
| `/portal/admin` | `src/pages/portal/admin.astro` | `admin` | `getAdminContext()` | Admin landing zone |
| `/portal/admin/feedback` | `src/pages/portal/admin/feedback.astro` | `admin` | `getAdminContext()` | Site feedback management |
| `/portal/admin/sms-requests` | `src/pages/portal/admin/sms-requests.astro` | `admin` | `getAdminContext()` | SMS feature requests |
| `/portal/admin/test-email` | `src/pages/portal/admin/test-email.astro` | `admin` | `getAdminContext()` | Test email & troubleshooting |
| `/portal/admin/usage` | `src/pages/portal/admin/usage.astro` | `admin` | `getAdminContext()` | Site usage analytics |
| `/portal/admin/audit-logs` | `src/pages/portal/admin/audit-logs.astro` | `admin` | `getAdminContext()` | Audit logs (redirects to `/board/audit-logs`) |
| `/portal/admin/backups` | `src/pages/portal/admin/backups.astro` | `admin` | `getAdminContext()` | Backups (redirects to `/board/backups`) |
| `/portal/admin/vendors` | `src/pages/portal/admin/vendors.astro` | `admin` | `getAdminContext()` | Vendors (redirects to `/board/vendors`) |
| `/portal/admin/maintenance` | `src/pages/portal/admin/maintenance.astro` | `admin` | `getAdminContext()` | Maintenance (redirects to `/board/maintenance`) |
| `/portal/admin/directory` | `src/pages/portal/admin/directory.astro` | `admin` | `getAdminContext()` | Directory (redirects to `/board/directory`) |
| `/portal/admin/contacts` | `src/pages/portal/admin/contacts.astro` | `admin` | `getAdminContext()` | Contacts (redirects to `/board/contacts`) |
| `/portal/admin/news` | `src/pages/portal/admin/news.astro` | `admin` | `getAdminContext()` | News (redirects to `/board/news`) |
| `/portal/admin/member-documents` | `src/pages/portal/admin/member-documents.astro` | `admin` | `getAdminContext()` | Member documents (redirects to `/board/member-documents`) |
| `/portal/admin/public-documents` | `src/pages/portal/admin/public-documents.astro` | `admin` | `getAdminContext()` | Public documents (redirects to `/board/public-documents`) |

### Board Routes (Elevated Access)

| Route | File | Allowed Roles | Route Guard | Description |
|-------|------|---------------|-------------|-------------|
| `/portal/board` | `src/pages/portal/board.astro` | `board`, `arb_board` | `getBoardContext()` | Board landing zone |
| `/portal/arb-dashboard` | `src/pages/portal/arb-dashboard.astro` | `board`, `arb_board`, `arb` | `getBoardContext()` or `getArbContext()` | ARB dashboard (shared) |
| `/board/directory` | `src/pages/board/directory.astro` | `board`, `arb_board` | `getBoardContext()` | Directory management |
| `/board/assessments` | `src/pages/board/assessments.astro` | `board`, `arb_board` | `getBoardContext()` | Dues/assessments management |
| `/board/vendors` | `src/pages/board/vendors.astro` | `board`, `arb_board`, `arb` | `getBoardContext()` or `getArbContext()` | Vendor management |
| `/board/meetings` | `src/pages/board/meetings.astro` | `board`, `arb_board`, `arb` | `getBoardContext()` or `getArbContext()` | Meetings management |
| `/board/maintenance` | `src/pages/board/maintenance.astro` | `board`, `arb_board`, `arb` | `getBoardContext()` or `getArbContext()` | Maintenance management |
| `/board/feedback` | `src/pages/board/feedback.astro` | `board`, `arb_board` | `getBoardContext()` | Feedback management |
| `/board/contacts` | `src/pages/board/contacts.astro` | `board`, `arb_board`, `arb` | `getBoardContext()` or `getArbContext()` | Contacts management |
| `/board/news` | `src/pages/board/news.astro` | `board`, `arb_board`, `arb` | `getBoardContext()` or `getArbContext()` | News management |
| `/board/library` | `src/pages/board/library.astro` | `board`, `arb_board`, `arb` | `getBoardContext()` or `getArbContext()` | Pre-approval library |
| `/board/public-documents` | `src/pages/board/public-documents.astro` | `board`, `arb_board`, `arb` | `getBoardContext()` or `getArbContext()` | Public documents |
| `/board/member-documents` | `src/pages/board/member-documents.astro` | `board`, `arb_board`, `arb` | `getBoardContext()` or `getArbContext()` | Member documents |
| `/board/audit-logs` | `src/pages/board/audit-logs.astro` | `board`, `arb_board`, `admin` | `getBoardContext()` or `getAdminContext()` | Audit logs |
| `/board/backups` | `src/pages/board/backups.astro` | `board`, `arb_board`, `arb`, `admin` | `getBoardContext()` or `getArbContext()` or `getAdminContext()` | Backups |

### ARB Routes (Elevated Access)

| Route | File | Allowed Roles | Route Guard | Description |
|-------|------|---------------|-------------|-------------|
| `/portal/arb` | `src/pages/portal/arb.astro` | `arb`, `arb_board` | `getArbContext()` | ARB landing zone |
| `/portal/arb-dashboard` | `src/pages/portal/arb-dashboard.astro` | `arb`, `arb_board`, `board` | `getArbContext()` or `getBoardContext()` | ARB dashboard (shared) |

### Authentication & Elevation Routes

| Route | File | Allowed Roles | Route Guard | Description |
|-------|------|---------------|-------------|-------------|
| `/portal/login` | `src/pages/portal/login.astro` | Public (no auth) | None | Login page |
| `/portal/request-elevated-access` | `src/pages/portal/request-elevated-access.astro` | `member` (with elevated whitelist) | `getPortalContext()` | PIM elevation request |
| `/portal/elevation-audit` | `src/pages/portal/elevation-audit.astro` | `member`, `admin`, `board`, `arb`, `arb_board` | `getPortalContext()` | Elevation audit log |
| `/portal/assume-role-help` | `src/pages/portal/assume-role-help.astro` | `admin`, `arb_board` | `getPortalContext()` | Assume-role help |

## Route Guard Utilities

### Available Guards

1. **`getPortalContext(Astro)`** - Member routes (baseline access)
   - Returns: `{ env, session, effectiveRole }`
   - Use for: All member-level routes

2. **`getAdminContext(Astro)`** - Admin-only routes
   - Returns: `{ env, session, effectiveRole }` or `{ redirect: string }`
   - Use for: `/portal/admin/*` routes
   - Redirects: Non-admin users to appropriate landing zone

3. **`getBoardContext(Astro)`** - Board-only routes
   - Returns: `{ env, session, effectiveRole }` or `{ redirect: string }`
   - Use for: `/portal/board` and `/board/*` routes
   - Redirects: Non-board users to appropriate landing zone

4. **`getArbContext(Astro)`** - ARB-only routes
   - Returns: `{ env, session, effectiveRole }` or `{ redirect: string }`
   - Use for: `/portal/arb` routes
   - Redirects: Non-ARB users to appropriate landing zone

### Usage Pattern

```typescript
// Example: Admin route
const ctx = await getAdminContext(Astro);
if ('redirect' in ctx) return Astro.redirect(ctx.redirect);
const { env, session, effectiveRole } = ctx;

// Example: Member route
const { env, session, effectiveRole } = await getPortalContext(Astro, { fingerprint: true });
if (!session) return Astro.redirect('/portal/login');
```

## Navigation Components

### Available Components

1. **`AdminNav.astro`** - Admin role navigation
   - Shows: Admin-only links from `adminLinks` config
   - Used on: `/portal/admin/*` pages

2. **`BoardNav.astro`** - Board role navigation
   - Shows: Board-only links from `boardLinks` config
   - Used on: `/portal/board` and `/board/*` pages

3. **`ArbNav.astro`** - ARB role navigation
   - Shows: ARB-only links from `arbLinks` config
   - Used on: `/portal/arb` pages

4. **`PortalNav.astro`** - Member navigation
   - Shows: Member links from `portalMainLinks` and `portalMoreLinks`
   - Hides member links when user is elevated (shows only elevated link)
   - Used on: All portal pages

## Role Landing Zones

| Role | Landing Zone | Redirect After Elevation |
|------|--------------|--------------------------|
| `member` | `/portal/dashboard` | Default baseline |
| `admin` | `/portal/admin` | After PIM elevation |
| `board` | `/portal/board` | After PIM elevation |
| `arb` | `/portal/arb` | After PIM elevation |
| `arb_board` | `/portal/board` | After PIM elevation (defaults to board) |

## Middleware Protection

All routes are protected by middleware (`src/middleware.ts`):

- **`/portal/*`** (except `/portal/login`): Requires session cookie
- **`/portal/admin*`**: Requires `effectiveRole === 'admin'`
- **`/portal/board`**: Requires `effectiveRole === 'board'` or `'arb_board'`
- **`/portal/arb`**: Requires `effectiveRole === 'arb'` or `'arb_board'`
- **`/board/*`**: Requires elevated role with role-specific permissions

## Notes

- All routes use server-side guards (Astro, not React hooks)
- Role context is managed via session (`getEffectiveRole(session)`)
- PIM elevation is handled via `/api/pim/elevate` endpoint
- Role de-elevation redirects to `/portal/dashboard` (member baseline)
- Admin can access some board routes (e.g., audit-logs, backups) via redirects
