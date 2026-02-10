# CLRHOA Portal - RBAC Route Scaffolding

## Overview

This document provides the complete folder structure, route boilerplate templates, and RBAC implementation guide for the HOA portal. The portal uses **Astro SSR** with **Cloudflare Pages**, and role-based access control is enforced via middleware and page-level guards.

## Architecture

### Authentication & Authorization Flow

1. **Middleware** (`src/middleware.ts`) - First line of defense
   - Checks session cookies on all `/portal/*` and `/board/*` routes
   - Redirects unauthenticated users to login
   - Enforces role-based access for elevated routes
   - Handles PIM (Privileged Identity Management) elevation

2. **RBAC Utilities** (`src/utils/rbac.ts`) - Page-level guards
   - `requireRoles()` - Verify user has required role
   - `getCurrentUser()` - Get current user and effective role
   - Helper functions for role checks

3. **Auth Library** (`src/lib/auth.ts`) - Core auth functions
   - Session management (signed cookies)
   - Role checking functions
   - PIM elevation handling

### Role Hierarchy

```
member (baseline)
  ├─ arb (Architectural Review Board)
  ├─ board (Board of Directors)
  ├─ arb_board (Combined ARB + Board)
  └─ admin (Site Administrator)
```

### Effective Role Concept

Users with elevated roles (`admin`, `board`, `arb`, `arb_board`) must explicitly **elevate their access** to perform privileged actions (PIM). The `effectiveRole` is:
- Their elevated role if within the 2-hour elevation window
- `member` if elevation has expired (they must re-elevate)
- For `admin` and `arb_board`: their `assumed_role` (board or arb) when acting in one capacity

## Folder Structure

### Current Structure (Existing)

```
src/pages/portal/
├── admin/                    # Admin-only routes
│   ├── audit-logs.astro
│   ├── backups.astro
│   ├── contacts.astro
│   ├── directory.astro
│   ├── feedback.astro
│   ├── maintenance.astro
│   ├── member-documents.astro
│   ├── news.astro
│   ├── public-documents.astro
│   ├── sms-requests.astro
│   ├── test-email.astro
│   ├── usage.astro
│   └── vendors.astro
├── assessments/
│   └── receipt/[id].astro
├── arb-request/
│   └── edit/[id].astro
├── admin.astro              # Admin landing zone
├── arb.astro                # ARB landing zone
├── arb-dashboard.astro      # ARB request review
├── arb-request.astro        # New ARB request form
├── assessments.astro        # Member dues view
├── assume-role-help.astro   # PIM help page
├── dashboard.astro          # Member landing zone
├── directory.astro          # Member directory
├── docs.astro              # Documentation
├── documents.astro         # Protected documents
├── elevation-audit.astro    # Elevation audit log
├── faq.astro               # FAQ
├── feedback.astro          # Submit feedback
├── library.astro           # Pre-approval library
├── login.astro             # Login page
├── maintenance.astro       # Maintenance schedule
├── meetings.astro          # Meeting calendar
├── my-activity.astro       # User activity log
├── my-info.astro          # User info (legacy)
├── my-requests.astro      # User's ARB requests
├── news.astro             # News & announcements
├── preferences.astro       # User preferences
├── profile.astro          # User profile
├── request-elevated-access.astro  # PIM elevation request
├── requests.astro         # ARB request overview
├── search.astro           # Portal search
├── usage.astro           # Usage analytics (admin)
└── vendors.astro         # Vendor directory

/board/                    # Board-only routes (top-level)
├── assessments/           # Payment tracking
├── audit-logs/            # Audit log review
├── backups/              # Database backups
├── contacts/             # Board contacts
├── directory/            # Full directory access
├── feedback/             # Feedback review
├── library/              # Library management
├── maintenance/          # Maintenance management
├── meetings/             # Meeting management
├── member-documents/     # Member document uploads
├── news/                 # News publishing
├── public-documents/     # Public document uploads
└── vendors/              # Vendor management
```

### Organizational Strategy

The portal uses **two folder patterns** for elevated routes:

1. **Admin routes**: `/portal/admin/*` - All admin functions under one namespace
2. **Board/ARB routes**: `/board/*` - Top-level for easier access and bookmarking

This dual pattern exists because:
- **Admin** is purely operational (site management)
- **Board/ARB** are governance roles that need prominent, memorable URLs

## Route Templates

### Member Route Template

```astro
---
// Accessible by: All authenticated users
// Description: [Brief description of page purpose]

import BaseLayout from '@/layouts/BaseLayout.astro';
import PortalNav from '@/components/PortalNav.astro';
import { getCurrentUser } from '@/utils/rbac';
import { getSessionFromCookie, getEffectiveRole } from '@/lib/auth';

const env = Astro.locals.runtime?.env;
const cookieHeader = Astro.request.headers.get('cookie') ?? undefined;
const session = await getSessionFromCookie(cookieHeader, env?.SESSION_SECRET);

if (!session) {
  return Astro.redirect('/portal/login');
}

const user = await getCurrentUser(Astro);
const effectiveRole = user?.effectiveRole ?? 'member';

const title = '[Page Title]';
---

<BaseLayout title={title}>
  <PortalNav currentPath={Astro.url.pathname} role={effectiveRole} staffRole={session.role} />

  <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8">
    <h1 class="text-3xl font-heading font-bold text-gray-900 portal-theme-text mb-6">
      {title}
    </h1>

    <!-- Page content here -->
    <div class="bg-white rounded-xl shadow-md portal-theme-card p-6">
      <p class="text-gray-600 portal-theme-text-muted">
        Page content goes here.
      </p>
    </div>
  </main>
</BaseLayout>
```

### Admin Route Template

```astro
---
// Accessible by: Admin role only
// Description: [Brief description of page purpose]

import BaseLayout from '@/layouts/BaseLayout.astro';
import PortalNav from '@/components/PortalNav.astro';
import AdminNav from '@/components/AdminNav.astro';
import { requireRoles, getCurrentUser } from '@/utils/rbac';
import { getSessionFromCookie } from '@/lib/auth';

// Require admin role - redirects if unauthorized
const redirectResponse = await requireRoles(Astro, ['admin']);
if (redirectResponse) return redirectResponse;

const user = await getCurrentUser(Astro);
const env = Astro.locals.runtime?.env;
const cookieHeader = Astro.request.headers.get('cookie') ?? undefined;
const session = await getSessionFromCookie(cookieHeader, env?.SESSION_SECRET);

const title = '[Page Title]';
---

<BaseLayout title={title}>
  <PortalNav currentPath={Astro.url.pathname} role={user!.effectiveRole} staffRole={session!.role} />
  <AdminNav currentPath={Astro.url.pathname} />

  <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-heading font-bold text-gray-900 portal-theme-text">
        {title}
      </h1>
      <p class="text-sm text-gray-500 portal-theme-text-muted mt-1">
        Admin access required
      </p>
    </div>

    <!-- Page content here -->
    <div class="bg-white rounded-xl shadow-md portal-theme-card p-6">
      <p class="text-gray-600 portal-theme-text-muted">
        Page content goes here.
      </p>
    </div>
  </main>
</BaseLayout>
```

### Board Route Template

```astro
---
// Accessible by: Board role only (or arb_board when elevated to board)
// Description: [Brief description of page purpose]

import BaseLayout from '@/layouts/BaseLayout.astro';
import PortalNav from '@/components/PortalNav.astro';
import BoardNav from '@/components/BoardNav.astro';
import { requireRoles, getCurrentUser } from '@/utils/rbac';
import { getSessionFromCookie } from '@/lib/auth';

// Require board or arb_board role
const redirectResponse = await requireRoles(Astro, ['board', 'arb_board']);
if (redirectResponse) return redirectResponse;

const user = await getCurrentUser(Astro);
const env = Astro.locals.runtime?.env;
const cookieHeader = Astro.request.headers.get('cookie') ?? undefined;
const session = await getSessionFromCookie(cookieHeader, env?.SESSION_SECRET);

const title = '[Page Title]';
---

<BaseLayout title={title}>
  <PortalNav currentPath={Astro.url.pathname} role={user!.effectiveRole} staffRole={session!.role} />
  <BoardNav currentPath={Astro.url.pathname} />

  <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-heading font-bold text-gray-900 portal-theme-text">
        {title}
      </h1>
      <p class="text-sm text-gray-500 portal-theme-text-muted mt-1">
        Board access required
      </p>
    </div>

    <!-- Page content here -->
    <div class="bg-white rounded-xl shadow-md portal-theme-card p-6">
      <p class="text-gray-600 portal-theme-text-muted">
        Page content goes here.
      </p>
    </div>
  </main>
</BaseLayout>
```

### ARB Route Template

```astro
---
// Accessible by: ARB or arb_board role
// Description: [Brief description of page purpose]

import BaseLayout from '@/layouts/BaseLayout.astro';
import PortalNav from '@/components/PortalNav.astro';
import ArbNav from '@/components/ArbNav.astro';
import { requireRoles, getCurrentUser } from '@/utils/rbac';
import { getSessionFromCookie } from '@/lib/auth';

// Require arb or arb_board role
const redirectResponse = await requireRoles(Astro, ['arb', 'arb_board']);
if (redirectResponse) return redirectResponse;

const user = await getCurrentUser(Astro);
const env = Astro.locals.runtime?.env;
const cookieHeader = Astro.request.headers.get('cookie') ?? undefined;
const session = await getSessionFromCookie(cookieHeader, env?.SESSION_SECRET);

const title = '[Page Title]';
---

<BaseLayout title={title}>
  <PortalNav currentPath={Astro.url.pathname} role={user!.effectiveRole} staffRole={session!.role} />
  <ArbNav currentPath={Astro.url.pathname} />

  <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-heading font-bold text-gray-900 portal-theme-text">
        {title}
      </h1>
      <p class="text-sm text-gray-500 portal-theme-text-muted mt-1">
        ARB access required
      </p>
    </div>

    <!-- Page content here -->
    <div class="bg-white rounded-xl shadow-md portal-theme-card p-6">
      <p class="text-gray-600 portal-theme-text-muted">
        Page content goes here.
      </p>
    </div>
  </main>
</BaseLayout>
```

## Complete Route Map

### Member Routes (All Authenticated Users)

| Path | Roles | Status | Description |
|------|-------|--------|-------------|
| `/portal/dashboard` | all | ✅ Exists | Member home dashboard |
| `/portal/directory` | all | ✅ Exists | HOA member directory |
| `/portal/documents` | all | ✅ Exists | Protected member documents |
| `/portal/profile` | all | ✅ Exists | User profile & settings |
| `/portal/requests` | all | ✅ Exists | ARB request status overview |
| `/portal/my-requests` | all | ✅ Exists | User's ARB requests |
| `/portal/arb-request` | all | ✅ Exists | Submit new ARB request |
| `/portal/arb-request/edit/[id]` | all | ✅ Exists | Edit ARB request |
| `/portal/maintenance` | all | ✅ Exists | Maintenance schedule |
| `/portal/meetings` | all | ✅ Exists | Meeting calendar & minutes |
| `/portal/vendors` | all | ✅ Exists | Recommended vendors |
| `/portal/library` | all | ✅ Exists | Pre-approved materials |
| `/portal/assessments` | all | ✅ Exists | Dues & payment history |
| `/portal/assessments/receipt/[id]` | all | ✅ Exists | Payment receipt |
| `/portal/feedback` | all | ✅ Exists | Submit board feedback |
| `/portal/news` | all | ✅ Exists | News & announcements |
| `/portal/docs` | all | ✅ Exists | Portal documentation |
| `/portal/faq` | all | ✅ Exists | FAQ |
| `/portal/my-activity` | all | ✅ Exists | User activity log |
| `/portal/search` | all | ✅ Exists | Portal search |

### Admin Routes

| Path | Roles | Status | Description |
|------|-------|--------|-------------|
| `/portal/admin` | admin | ✅ Exists | Admin landing zone |
| `/portal/admin/feedback` | admin | ✅ Exists | Site feedback management |
| `/portal/admin/sms-requests` | admin | ✅ Exists | SMS opt-in requests |
| `/portal/admin/test-email` | admin | ✅ Exists | Email testing |
| `/portal/admin/backups` | admin | ✅ Exists | Database backups |
| `/portal/admin/usage` | admin | ✅ Exists | Site analytics |
| `/portal/admin/audit-logs` | admin | ✅ Exists | Security & audit logs |
| `/portal/admin/vendors` | admin | ✅ Exists | Vendor management |
| `/portal/admin/maintenance` | admin | ✅ Exists | Maintenance management |
| `/portal/admin/directory` | admin | ✅ Exists | Directory (read-only) |
| `/portal/admin/contacts` | admin | ✅ Exists | Board contact management |
| `/portal/admin/news` | admin | ✅ Exists | News management |
| `/portal/admin/member-documents` | admin | ✅ Exists | Member document uploads |
| `/portal/admin/public-documents` | admin | ✅ Exists | Public document uploads |

### Board Routes

| Path | Roles | Status | Description |
|------|-------|--------|-------------|
| `/portal/board` | board, arb_board | ✅ Exists | Board landing zone |
| `/board/directory` | board, arb_board | 🔨 Needs page | Full directory access & CRUD |
| `/board/assessments` | board | 🔨 Needs page | Payment tracking & recording |
| `/board/vendors` | board, arb, arb_board | 🔨 Needs page | Vendor approvals |
| `/board/meetings` | board, arb, arb_board | 🔨 Needs page | Meeting management |
| `/board/maintenance` | board, arb, arb_board | 🔨 Needs page | Maintenance management |
| `/board/feedback` | board, arb, arb_board | 🔨 Needs page | Feedback review |
| `/board/contacts` | board, arb, arb_board | 🔨 Needs page | Contact management |
| `/board/news` | board, arb, arb_board | 🔨 Needs page | News publishing |
| `/board/library` | board, arb, arb_board | 🔨 Needs page | Library management |
| `/board/public-documents` | board, arb, arb_board | 🔨 Needs page | Public doc uploads |
| `/board/member-documents` | board, arb, arb_board | 🔨 Needs page | Member doc uploads |
| `/board/audit-logs` | board | 🔨 Needs page | Audit log review |
| `/board/backups` | board, arb, arb_board | 🔨 Needs page | Database backups |

### ARB Routes

| Path | Roles | Status | Description |
|------|-------|--------|-------------|
| `/portal/arb` | arb, arb_board | ✅ Exists | ARB landing zone |
| `/portal/arb-dashboard` | arb, arb_board, board | ✅ Exists | ARB request dashboard |

### PIM & Utility Routes

| Path | Roles | Status | Description |
|------|-------|--------|-------------|
| `/portal/request-elevated-access` | elevated staff | ✅ Exists | Request PIM elevation |
| `/portal/elevation-audit` | elevated staff | ✅ Exists | Elevation audit log |
| `/portal/assume-role-help` | admin, arb_board | ✅ Exists | Role assumption help |

## RBAC Implementation Checklist

### ✅ Already Implemented

- [x] Middleware-based route protection
- [x] Session management with signed cookies
- [x] PIM (Privileged Identity Management) elevation
- [x] Role-based navigation components
- [x] Landing zones per role
- [x] Admin route structure (`/portal/admin/*`)
- [x] Member routes with proper guards
- [x] ARB landing zone

### 🔨 To Be Implemented

- [ ] Create missing `/board/*` pages
- [ ] Update navigation configs if needed
- [ ] Create route documentation generator
- [ ] Add automated RBAC testing suite
- [ ] Create role-based dashboard widgets

## Testing RBAC

### Manual Testing Checklist

1. **Member Access**
   - [ ] Can access all `/portal/*` member routes
   - [ ] Cannot access `/portal/admin/*`
   - [ ] Cannot access `/board/*`
   - [ ] Redirected to dashboard from elevated routes

2. **Admin Access**
   - [ ] Can elevate to admin
   - [ ] Can access all `/portal/admin/*` routes
   - [ ] Cannot access `/board/*` routes
   - [ ] Can view directory read-only

3. **Board Access**
   - [ ] Can elevate to board
   - [ ] Can access all `/board/*` routes
   - [ ] Can access member routes
   - [ ] Can record payments
   - [ ] Can manage directory

4. **ARB Access**
   - [ ] Can elevate to ARB
   - [ ] Can access ARB dashboard
   - [ ] Can approve/reject requests
   - [ ] Can access shared `/board/*` routes
   - [ ] Cannot access `/board/assessments`
   - [ ] Cannot access `/board/directory`

5. **ARB_Board Access**
   - [ ] Can assume board OR arb role (not both)
   - [ ] One role at a time enforcement
   - [ ] 2-hour timeout on assumed role
   - [ ] Can switch between roles

### Automated Testing

Create test file: `src/tests/rbac.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { canAccessRoute } from '@/utils/rbac';

describe('RBAC Route Access', () => {
  it('members cannot access admin routes', () => {
    expect(canAccessRoute('member', '/portal/admin')).toBe(false);
  });

  it('admins can access admin routes', () => {
    expect(canAccessRoute('admin', '/portal/admin')).toBe(true);
  });

  it('board can access board routes', () => {
    expect(canAccessRoute('board', '/board/directory')).toBe(true);
  });

  it('arb cannot access assessments', () => {
    expect(canAccessRoute('arb', '/board/assessments')).toBe(false);
  });
});
```

## Next Steps

1. **Create Missing Board Pages** - Use templates above
2. **Update Navigation** - Ensure all links are in `navigation.ts`
3. **Add Tests** - Implement automated RBAC testing
4. **Document APIs** - Create API route documentation
5. **Performance Audit** - Test middleware performance
6. **Security Review** - Audit session handling and PIM

## Support & References

- **Middleware**: `src/middleware.ts`
- **Auth Library**: `src/lib/auth.ts`
- **RBAC Utils**: `src/utils/rbac.ts`
- **Navigation Config**: `src/config/navigation.ts`
- **Phase Documentation**: `CLAUDE.md`

---

**Generated**: 2026-02-10
**Status**: Active Implementation Guide
**Maintainer**: Claude Code Assistant
