# RBAC Implementation Summary

Complete implementation of Role-Based Access Control (RBAC) for the portal.

## Architecture Overview

The portal uses **server-side RBAC** (Astro) with:
- **Session-based role management** via signed cookies
- **PIM (Privileged Identity Management)** for JIT elevation
- **Route-level guards** for access control
- **Modular navigation components** per role

## Role Definitions

### Member (Baseline)
- **Role**: `member`
- **Landing Zone**: `/portal/dashboard`
- **Access**: All `/portal/*` routes (except elevated-only)
- **No elevation required**

### Admin (Elevated)
- **Role**: `admin`
- **Landing Zone**: `/portal/admin`
- **Access**: `/portal/admin/*` routes
- **PIM Required**: Yes (2-hour window)
- **Can Assume**: Board or ARB role (via assume-role)

### Board (Elevated)
- **Role**: `board`
- **Landing Zone**: `/portal/board`
- **Access**: `/portal/board` and `/board/*` routes
- **PIM Required**: Yes (2-hour window)
- **Permissions**: Full board management capabilities

### ARB (Elevated)
- **Role**: `arb`
- **Landing Zone**: `/portal/arb`
- **Access**: `/portal/arb` and ARB-allowed `/board/*` routes
- **PIM Required**: Yes (2-hour window)
- **Permissions**: ARB request approval, library access

### ARB+Board (Elevated)
- **Role**: `arb_board`
- **Landing Zone**: `/portal/board` (default)
- **Access**: Both ARB and Board routes
- **PIM Required**: Yes (2-hour window)
- **Can Assume**: Board or ARB role (via assume-role)

## Context Management

### Server-Side Context (Astro)

Since this is Astro (not React), role context is managed server-side:

**File**: `src/lib/board-context.ts`

```typescript
// Admin context
export async function getAdminContext(astro: RoleContextAstro): Promise<GetRoleContextResult>

// Board context
export async function getBoardContext(astro: RoleContextAstro): Promise<GetRoleContextResult>

// ARB context
export async function getArbContext(astro: RoleContextAstro): Promise<GetRoleContextResult>
```

**File**: `src/lib/portal-context.ts`

```typescript
// Member context (baseline)
export async function getPortalContext(astro: PortalContextAstro, options?: { fingerprint?: boolean }): Promise<PortalContextResult>
```

### Role State Storage

- **Session Cookie**: Stores `role`, `elevated_until`, `assumed_role`
- **Effective Role**: Calculated via `getEffectiveRole(session)` in `src/lib/auth.ts`
- **PIM State**: `elevated_until` timestamp (2-hour TTL)

## Route Guards

### Guard Pattern

All protected routes follow this pattern:

```typescript
// 1. Call appropriate guard
const ctx = await getAdminContext(Astro);

// 2. Check for redirect
if ('redirect' in ctx) return Astro.redirect(ctx.redirect);

// 3. Extract context
const { env, session, effectiveRole } = ctx;
```

### Guard Utilities

**File**: `src/lib/route-guards.ts`

Provides helper functions:
- `withAdminProtection(astro)` → `getAdminContext(astro)`
- `withBoardProtection(astro)` → `getBoardContext(astro)`
- `withArbProtection(astro)` → `getArbContext(astro)`
- `withRoleProtection(astro, requiredRole)` → Generic guard

## Navigation Components

### Modular Components

1. **AdminNav.astro** (`src/components/AdminNav.astro`)
   - Admin-only navigation
   - Links from `adminLinks` config
   - Used on `/portal/admin/*` pages

2. **BoardNav.astro** (`src/components/BoardNav.astro`)
   - Board-only navigation
   - Links from `boardLinks` config
   - Used on `/portal/board` and `/board/*` pages

3. **ArbNav.astro** (`src/components/ArbNav.astro`)
   - ARB-only navigation
   - Links from `arbLinks` config
   - Used on `/portal/arb` pages

4. **PortalNav.astro** (`src/components/PortalNav.astro`)
   - Member navigation (baseline)
   - Hides member links when user is elevated
   - Shows elevated link in "More" dropdown
   - Used on all portal pages

## Role Elevation Flow

### PIM Elevation

1. **User with elevated whitelist role** logs in → sees member-level access
2. **User requests elevation** → `/api/pim/elevate` endpoint
3. **Session updated** with `elevated_until` timestamp (2-hour TTL)
4. **User redirected** to role's landing zone:
   - Admin → `/portal/admin`
   - Board → `/portal/board`
   - ARB → `/portal/arb`

### PIM De-Elevation

1. **User drops elevation** → `/api/pim/drop` endpoint
2. **Session updated** with `elevated_until = null`
3. **User redirected** to `/portal/dashboard` (member baseline)

### Assume-Role (Admin/arb_board)

1. **Admin or arb_board** requests role assumption → `/api/admin/assume-role`
2. **Session updated** with `assumed_role`, `assumed_at`, `assumed_until`
3. **Effective role** becomes assumed role (board or arb)
4. **User can perform** actions as assumed role
5. **Role expires** after 2 hours or user drops it

## Middleware Protection

**File**: `src/middleware.ts`

Middleware enforces:
- **`/portal/*`** (except login): Requires session cookie
- **`/portal/admin*`**: Requires `effectiveRole === 'admin'`
- **`/portal/board`**: Requires `effectiveRole === 'board'` or `'arb_board'`
- **`/portal/arb`**: Requires `effectiveRole === 'arb'` or `'arb_board'`
- **`/board/*`**: Requires elevated role with role-specific permissions

## Route Map

See `docs/ROUTE_MAP.md` for complete route listing with:
- Page paths
- Allowed roles
- Route guards applied
- Descriptions

## Configuration

### Role Landing Zones

**File**: `src/config/navigation.ts`

```typescript
export const ROLE_LANDING: Record<string, string> = {
  admin: '/portal/admin',
  board: '/portal/board',
  arb: '/portal/arb',
  arb_board: '/portal/board',
  member: '/portal/dashboard',
};
```

### Navigation Links

- **`adminLinks`**: Admin-only navigation
- **`boardLinks`**: Board-only navigation
- **`arbLinks`**: ARB-only navigation
- **`portalMainLinks`**: Member main navigation
- **`portalMoreLinks`**: Member "More" dropdown links

## Security Features

1. **Session Security**
   - Signed cookies (HMAC-SHA256)
   - HttpOnly, Secure, SameSite=Lax
   - 7-day expiration

2. **PIM Elevation**
   - 2-hour TTL
   - Audit logged
   - Automatic expiration

3. **Assume-Role**
   - 2-hour TTL
   - One role at a time
   - Audit logged

4. **Route Guards**
   - Server-side enforcement
   - Multiple layers (middleware + page-level)
   - Type-safe context

## Testing Checklist

- [ ] Member can access member routes
- [ ] Member cannot access elevated routes
- [ ] Admin can access admin routes after elevation
- [ ] Board can access board routes after elevation
- [ ] ARB can access ARB routes after elevation
- [ ] PIM elevation redirects to correct landing zone
- [ ] PIM de-elevation redirects to dashboard
- [ ] Assume-role works for admin/arb_board
- [ ] Navigation shows correct links per role
- [ ] Member nav hides when elevated

## Future Enhancements

1. **Client-side role context** (if migrating to React)
   - `useRoleContext()` hook
   - `RoleContextProvider` component
   - Real-time role updates

2. **Route-level permissions**
   - Granular permission checks
   - Dynamic route access based on permissions

3. **Role inheritance**
   - Hierarchical role system
   - Permission inheritance
