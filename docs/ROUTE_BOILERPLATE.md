# Route Boilerplate Templates

Standard templates for creating new portal routes with proper RBAC guards.

## Member Route Template

```astro
---
/**
 * MEMBER ROUTE: [Route Name]
 *
 * Required permissions: effectiveRole === 'member' (or any elevated role)
 *
 * Route-level guard: Uses getPortalContext() for baseline member access.
 * All logged-in users can access this route.
 */
export const prerender = false;

import PortalLayout from '../../layouts/PortalLayout.astro';
import ProtectedPage from '../../components/ProtectedPage.astro';
import PortalNav from '../../components/PortalNav.astro';
import { getPortalContext } from '../../lib/portal-context';
import { listArbRequestsByHousehold } from '../../lib/arb-db';

const { env, session, effectiveRole } = await getPortalContext(Astro, { fingerprint: true });
if (!session) return Astro.redirect('/portal/login');

const db = env?.DB;
const allRequests = db ? await listArbRequestsByHousehold(db, session.email) : [];
const draftCount = allRequests.filter((r) => r.status === 'pending').length;
---

<PortalLayout title="[Page Title] | Member Portal | Crooked Lake Reserve HOA">
  <ProtectedPage>
    <div class="min-h-screen portal-theme-bg font-body">
      <PortalNav currentPath="/portal/[route]" draftCount={draftCount} role={effectiveRole} staffRole={session.role ?? ''} />

      <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div class="mb-6">
          <h2 class="text-2xl font-heading font-bold text-clr-green mb-1">[Page Title]</h2>
          <p class="text-gray-600 text-sm">[Page description]</p>
        </div>

        <!-- Page content here -->
      </main>
    </div>
  </ProtectedPage>
</PortalLayout>
```

## Admin Route Template

```astro
---
/**
 * ADMIN-ONLY: [Route Name]
 *
 * Required permissions: effectiveRole === 'admin'
 *
 * Route-level guard: Uses getAdminContext() to enforce admin-only access.
 * Redirects non-admin users to their appropriate landing zone:
 * - board/arb_board → /portal/board
 * - arb → /portal/arb
 * - admin whitelist but not elevated → /portal/request-elevated-access
 * - member → /portal/dashboard
 */
export const prerender = false;

import PortalLayout from '../../../layouts/PortalLayout.astro';
import ProtectedPage from '../../../components/ProtectedPage.astro';
import PortalNav from '../../../components/PortalNav.astro';
import AdminNav from '../../../components/AdminNav.astro';
import { getAdminContext } from '../../../lib/board-context';
import { listArbRequestsByHousehold } from '../../../lib/arb-db';

// Route-level guard: enforce admin-only access
const ctx = await getAdminContext(Astro);
if ('redirect' in ctx) return Astro.redirect(ctx.redirect);
const { env, session, effectiveRole } = ctx;

const db = env?.DB;
const allRequests = db ? await listArbRequestsByHousehold(db, session.email) : [];
const draftCount = allRequests.filter((r) => r.status === 'pending').length;
---

<PortalLayout title="[Page Title] | Admin | Member Portal | Crooked Lake Reserve HOA">
  <ProtectedPage>
    <div class="min-h-screen portal-theme-bg font-body">
      <PortalNav currentPath="/portal/admin/[route]" draftCount={draftCount} role={effectiveRole} staffRole={session.role ?? ''} />
      <AdminNav currentPath="/portal/admin/[route]" />

      <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div class="mb-6">
          <h2 class="text-2xl font-heading font-bold text-clr-green mb-1">[Page Title]</h2>
          <p class="text-gray-600 text-sm">[Page description]</p>
        </div>

        <!-- Page content here -->
      </main>
    </div>
  </ProtectedPage>
</PortalLayout>
```

## Board Route Template

```astro
---
/**
 * BOARD-ONLY: [Route Name]
 *
 * Required permissions: effectiveRole === 'board' or 'arb_board'
 *
 * Route-level guard: Uses getBoardContext() to enforce board-only access.
 * Redirects non-board users to their appropriate landing zone:
 * - admin → /portal/admin
 * - arb → /portal/arb
 * - board/arb_board whitelist but not elevated → /portal/request-elevated-access
 * - member → /portal/dashboard
 */
export const prerender = false;

import BoardLayout from '../../layouts/BoardLayout.astro';
import { getBoardContext } from '../../lib/board-context';

// Route-level guard: enforce board-only access
const ctx = await getBoardContext(Astro);
if ('redirect' in ctx) return Astro.redirect(ctx.redirect);
const { env, session, effectiveRole } = ctx;
---

<BoardLayout title="[Page Title]" draftCount={0} role={effectiveRole} session={session} elevatedUntil={session.elevated_until} mainWide showRoleBanner={false}>
  <!-- Page content here -->
</BoardLayout>
```

## ARB Route Template

```astro
---
/**
 * ARB-ONLY: [Route Name]
 *
 * Required permissions: effectiveRole === 'arb' or 'arb_board'
 *
 * Route-level guard: Uses getArbContext() to enforce ARB-only access.
 * Redirects non-ARB users to their appropriate landing zone:
 * - admin → /portal/admin
 * - board → /portal/board
 * - arb/arb_board whitelist but not elevated → /portal/request-elevated-access
 * - member → /portal/dashboard
 */
export const prerender = false;

import PortalLayout from '../../layouts/PortalLayout.astro';
import ProtectedPage from '../../components/ProtectedPage.astro';
import PortalNav from '../../components/PortalNav.astro';
import ArbNav from '../../components/ArbNav.astro';
import { getArbContext } from '../../lib/board-context';
import { getArbRequestCountsByStatus, listArbRequestsByHousehold } from '../../lib/arb-db';

// Route-level guard: enforce ARB-only access
const ctx = await getArbContext(Astro);
if ('redirect' in ctx) return Astro.redirect(ctx.redirect);
const { env, session, effectiveRole } = ctx;

const db = env?.DB;
const allRequests = db ? await listArbRequestsByHousehold(db, session.email) : [];
const draftCount = allRequests.filter((r) => r.status === 'pending').length;
const arbCounts = db ? await getArbRequestCountsByStatus(db) : { in_review: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
---

<PortalLayout title="[Page Title] | ARB | Member Portal | Crooked Lake Reserve HOA">
  <ProtectedPage>
    <div class="min-h-screen portal-theme-bg font-body">
      <PortalNav currentPath="/portal/arb/[route]" draftCount={draftCount} role={effectiveRole} staffRole={session.role ?? ''} arbInReviewCount={arbCounts.in_review} />
      <ArbNav currentPath="/portal/arb/[route]" />

      <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div class="mb-6">
          <h2 class="text-2xl font-heading font-bold text-clr-green mb-1">[Page Title]</h2>
          <p class="text-gray-600 text-sm">[Page description]</p>
        </div>

        <!-- Page content here -->
      </main>
    </div>
  </ProtectedPage>
</PortalLayout>
```

## Shared Board/ARB Route Template

For routes accessible by both Board and ARB (e.g., `/board/vendors`):

```astro
---
/**
 * BOARD/ARB: [Route Name]
 *
 * Required permissions: effectiveRole === 'board', 'arb_board', or 'arb'
 *
 * Route-level guard: Uses getBoardContext() or getArbContext() depending on route.
 * Admin can also access via redirect from /portal/admin/*.
 */
export const prerender = false;

import BoardLayout from '../../layouts/BoardLayout.astro';
import { getBoardContext } from '../../lib/board-context';

// Route-level guard: enforce board/arb access
// Note: Admin can access via middleware redirect from /portal/admin/*
const ctx = await getBoardContext(Astro);
if ('redirect' in ctx) return Astro.redirect(ctx.redirect);
const { env, session, effectiveRole } = ctx;
---

<BoardLayout title="[Page Title]" draftCount={0} role={effectiveRole} session={session} elevatedUntil={session.elevated_until} mainWide showRoleBanner={false}>
  <!-- Page content here -->
</BoardLayout>
```

## Route Guard Helper Functions

### Available Guards

Located in `src/lib/board-context.ts`:

- **`getAdminContext(astro)`** - Admin-only routes
- **`getBoardContext(astro)`** - Board/arb_board routes
- **`getArbContext(astro)`** - ARB/arb_board routes

Located in `src/lib/portal-context.ts`:

- **`getPortalContext(astro, options?)`** - Member routes (baseline)

### Guard Return Types

All role-specific guards return:
```typescript
type GetRoleContextResult =
  | { env: RoleEnv; session: SessionPayload; effectiveRole: string }
  | { redirect: string };
```

Always check for redirect:
```typescript
const ctx = await getAdminContext(Astro);
if ('redirect' in ctx) return Astro.redirect(ctx.redirect);
const { env, session, effectiveRole } = ctx;
```

## Navigation Components

### AdminNav.astro
- **Location**: `src/components/AdminNav.astro`
- **Props**: `currentPath: string`
- **Usage**: Admin-only pages under `/portal/admin/*`

### BoardNav.astro
- **Location**: `src/components/BoardNav.astro`
- **Props**: `currentPath: string`
- **Usage**: Board pages at `/portal/board` and `/board/*`

### ArbNav.astro
- **Location**: `src/components/ArbNav.astro`
- **Props**: `currentPath: string`
- **Usage**: ARB pages at `/portal/arb`

### PortalNav.astro
- **Location**: `src/components/PortalNav.astro`
- **Props**: `currentPath`, `draftCount?`, `role?`, `staffRole?`, `arbInReviewCount?`, `vendorPendingCount?`
- **Usage**: All portal pages (shows member nav, hides when elevated)

## Best Practices

1. **Always use route guards** - Never skip the guard check
2. **Document permissions** - Include header comment explaining required role
3. **Consistent redirects** - Use role landing zones from `ROLE_LANDING` config
4. **Type safety** - Use TypeScript types from context helpers
5. **Error handling** - Check for redirect before accessing context properties
6. **Navigation consistency** - Use appropriate nav component for role
7. **Layout consistency** - Use `PortalLayout` for portal pages, `BoardLayout` for board pages
