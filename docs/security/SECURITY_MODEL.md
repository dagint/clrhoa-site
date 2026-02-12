# Security Model: Authentication, RBAC, and PIM

This document provides a comprehensive overview of the authentication, role-based access control (RBAC), and Privileged Identity Management (PIM) systems implemented in the Crooked Lake Reserve HOA portal.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication System](#authentication-system)
3. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
4. [Privileged Identity Management (PIM)](#privileged-identity-management-pim)
5. [Access Control Patterns](#access-control-patterns)
6. [Security Features](#security-features)
7. [Implementation Details](#implementation-details)

---

## Architecture Overview

The security model is built on three foundational layers:

1. **Authentication**: Verifies user identity through session management
2. **Authorization (RBAC)**: Controls what users can access based on their roles
3. **Privileged Access (PIM)**: Manages temporary elevation and role assumption for sensitive operations

### Security Zones

| Zone | Paths | Authentication | Authorization |
|------|-------|----------------|--------------|
| **Public** | `/`, `/about`, `/contact`, `/documents`, `/news` | None | None (public data only) |
| **Portal** | `/portal/*` (except `/portal/login`) | Session required | Member-level access |
| **Board/Admin** | `/board/*`, `/admin/*`, elevated APIs | Session + elevated role | Role-based permissions |

---

## Authentication System

### Session Management

**Session Cookie**: `clrhoa_session`
- **Signing**: HMAC-SHA256 using `SESSION_SECRET`
- **Attributes**: HttpOnly, Secure (production), SameSite=Lax
- **Max Age**: 7 days
- **Inactivity Timeout**: 30 minutes (optional, configurable)

**Session Payload Structure** (`SessionPayload`):
```typescript
{
  email: string;              // User's email (primary identifier)
  role: string;              // Base role (member, arb, board, arb_board, admin)
  name: string | null;       // Display name
  exp: number;               // Expiration timestamp (Unix seconds)
  csrfToken?: string;        // CSRF protection token
  lastActivity?: number;      // Last activity timestamp (for timeout)
  sessionId?: string;        // Unique session identifier
  fingerprint?: string;       // Browser + IP fingerprint (SHA-256 hash)
  createdAt?: number;         // Session creation timestamp
  elevated_until?: number;    // PIM: JIT elevation expiration (Unix ms)
  assumed_role?: 'board' | 'arb';  // Admin/arb_board: temporary role assumption
  assumed_at?: number;        // When role was assumed (Unix ms)
  assumed_until?: number;     // When assumed role expires (Unix ms)
}
```

### Login Whitelist (KV Store)

**Storage**: Cloudflare KV namespace (`CLOURHOA_USERS`)

**Purpose**: Controls who can log in to the portal

**Format**:
- **Member**: `"1"` (plain string)
- **Elevated Role**: `{"role": "board"}` (JSON string)

**Key Functions**:
- `isEmailWhitelisted(kv, email)`: Check if email can log in
- `getWhitelistRole(kv, email)`: Get role from whitelist (default: "member")
- `setLoginWhitelistRole(kv, email, role)`: Set or update role
- `addToLoginWhitelistIfMissing(kv, email)`: Add member without overwriting existing roles
- `removeFromLoginWhitelistUnlessAdmin(kv, email)`: Remove entry (preserves admin)

**Special Cases**:
- **Admin accounts**: Can log in even if removed from directory (KV entry preserved)
- **Directory sync**: Adding owner to directory automatically adds to whitelist as "member"
- **Role assignment**: Board directory allows setting roles (board, arb, arb_board, admin)

### Session Fingerprinting

**Purpose**: Detect potential session hijacking by verifying browser/IP consistency

**Implementation**:
- **Hash Algorithm**: SHA-256 (via `crypto.subtle.digest`)
- **Input**: `userAgent|ipAddress` (with fallback to "unknown" for null values)
- **Storage**: Stored in session payload as `fingerprint`
- **Verification**: On each request, current fingerprint compared to session fingerprint

**Security Properties**:
- Cryptographically secure (SHA-256)
- Collision-resistant
- Prevents session reuse across different browsers/IPs

**Legacy Support**: Sessions without fingerprints are allowed (backward compatibility)

### Session Lifecycle

1. **Login**: User authenticates → session cookie created with fingerprint
2. **Request**: Middleware validates cookie signature and expiration
3. **Activity Tracking**: `lastActivity` updated on authenticated requests
4. **Timeout**: Sessions expire after inactivity (if configured)
5. **Logout**: Cookie cleared (client-side) or expires naturally

---

## Role-Based Access Control (RBAC)

### Role Hierarchy

**Standard Roles**:
- `member`: Regular homeowner (default)
- `arb`: Architectural Review Board member
- `board`: Board of Directors member
- `arb_board`: Member of both ARB and Board
- `admin`: System administrator (technical support)

**Role Sets**:
- `VALID_ROLES`: All valid roles (`member`, `arb`, `board`, `arb_board`, `admin`)
- `ELEVATED_ROLES`: Roles with elevated privileges (`arb`, `board`, `arb_board`, `admin`)

### Role Permissions

#### Member (`member`)
- Access portal pages
- View own ARB requests
- View own assessments/payments
- Submit ARB requests
- View public directory (limited)
- View member documents (shared library)

#### ARB (`arb`)
- **All member permissions**, plus:
- View all ARB requests
- Approve/reject ARB requests
- Set review deadlines
- Add ARB internal notes
- Access ARB dashboard
- View preapproval library

**Restrictions**:
- Cannot manage feedback documents
- Cannot manage meetings
- Cannot record payments
- Cannot manage vendors (read-only)

#### Board (`board`)
- **All member permissions**, plus:
- Manage feedback documents (create, update, delete, export)
- Manage meetings (create, update, delete, upload agendas)
- Manage maintenance requests (update status, assign vendors)
- Manage vendors (CRUD operations)
- Record assessment payments
- Manage member documents (upload, delete)
- Manage news items (create, update, delete, add photos)
- View all ARB requests (read-only, cannot approve)
- Access board pages (`/board/*`)

**Restrictions**:
- Cannot approve ARB requests (ARB-only function)

#### ARB+Board (`arb_board`)
- **All ARB permissions**, plus:
- **All Board permissions** (when acting as Board)
- Can switch between ARB and Board roles (via assume-role)

**Important**: Must explicitly assume Board role to perform Board actions (e.g., record payments, manage feedback)

#### Admin (`admin`)
- **View-only access** to most features (by default)
- Can assume Board or ARB role (via assume-role) for technical support
- Full access when acting in assumed role
- Can manage directory (read-only without assumption)
- Access admin pages (`/admin/*`)

**Restrictions**:
- Cannot perform actions without assuming a role
- Cannot approve ARB requests without assuming ARB role
- Cannot record payments without assuming Board role

### Effective Role Calculation

The `getEffectiveRole()` function determines the user's current effective role for access control:

```typescript
function getEffectiveRole(session: SessionPayload | null): string
```

**Logic**:
1. **No session** → `'member'`
2. **Non-elevated role** → Return session role as-is
3. **Elevated role without PIM elevation** → `'member'` (JIT elevation required)
4. **Admin/arb_board with assumed role** → Return `assumed_role` (board or arb)
5. **Otherwise** → Return session role

**Key Points**:
- Elevated roles require PIM elevation to access elevated features
- Admin/arb_board must assume a specific role to perform actions
- One assumed role at a time (enforced by timeout)

### Granular Permission Helpers

**Board-Only Operations** (`isBoardOnly(role)`):
- Feedback management
- Meetings management
- Maintenance updates
- Vendor management
- Member document uploads
- Assessment payment recording
- News item management

**ARB-Only Operations** (`canApproveArb(role)`):
- ARB request approval/rejection
- ARB deadline setting
- ARB internal notes

**Payment Recording** (`canRecordPayments(role)`):
- Only `'board'` role (not arb_board unless assumed)

**Directory Management** (`isBoardOrArbOnly(role)`):
- Directory CRUD operations
- Directory CSV export
- Excludes admin (admin has view-only)

---

## Privileged Identity Management (PIM)

### Just-In-Time (JIT) Elevation

**Purpose**: Require elevated users to explicitly request elevated access before using elevated features

**How It Works**:
1. User with elevated whitelist role logs in → sees member-level access
2. User requests elevation → `/api/pim/elevate` endpoint
3. Session updated with `elevated_until` timestamp (2-hour TTL)
4. User now has elevated access until expiration
5. User can drop elevation anytime → `/api/pim/drop` endpoint

**Who Can Elevate**:
- Users with elevated whitelist roles: `arb`, `board`, `arb_board`, `admin`

**TTL**: 2 hours (`PIM_ELEVATION_TTL_MS`)

**Audit**: All elevation/drop actions logged in `pim_elevation_log` table

**Benefits**:
- Reduces attack surface (elevated access only when needed)
- Provides audit trail of when elevated access was used
- Automatic expiration prevents forgotten elevated sessions

### Assume-Role Functionality

**Purpose**: Allow admin and arb_board users to temporarily act as Board or ARB (one at a time)

**Who Can Assume Roles**:
- `admin`: Can assume `board` or `arb`
- `arb_board`: Can assume `board` or `arb`

**How It Works**:
1. User requests role assumption → `/api/admin/assume-role`
2. Session updated with `assumed_role`, `assumed_at`, `assumed_until`
3. `getEffectiveRole()` returns assumed role instead of base role
4. User performs actions as assumed role
5. Role expires after 2 hours or user drops it

**Restrictions**:
- One role at a time (cannot assume both Board and ARB simultaneously)
- Must drop current role before assuming the other
- 2-hour TTL (`ASSUMED_ROLE_TTL_MS`)

**Use Cases**:
- **Admin**: Technical support (assume Board to record payments, assume ARB to approve requests)
- **arb_board**: Switch between ARB and Board duties (approve requests vs. manage meetings)

**Audit**: All assume/clear actions logged in `admin_assumed_role_audit` table with:
- Admin email
- Actor role (admin or arb_board)
- Action (assume/clear)
- Role assumed (board/arb)
- Action detail
- IP address
- Timestamp

### PIM vs. Assume-Role

| Feature | PIM (JIT Elevation) | Assume-Role |
|---------|---------------------|-------------|
| **Who** | All elevated roles | Admin, arb_board only |
| **Purpose** | Enable elevated access | Switch between Board/ARB |
| **Effect** | Unlocks elevated features | Changes effective role |
| **TTL** | 2 hours | 2 hours |
| **Audit** | `pim_elevation_log` | `admin_assumed_role_audit` |

---

## Access Control Patterns

### Middleware Enforcement

**Location**: `src/middleware.ts`

**Portal Routes** (`/portal/*`):
- Requires valid session cookie
- Redirects to `/portal/login` if missing
- Checks profile completeness (name, address, phone)
- Redirects to `/portal/profile?required=1` if incomplete

**Board Routes** (`/board/*`):
- Requires valid session cookie
- Requires elevated role (`isElevatedRole()`)
- Redirects non-elevated users to `/portal/dashboard`

**Elevated API Prefixes**:
- `/api/admin/*`
- `/api/board/*`
- `/api/owners`
- `/api/meetings`
- `/api/maintenance-update`
- `/api/public-document-upload`
- `/api/member-document`
- `/api/arb-approve`
- `/api/arb-notes`
- `/api/arb-deadline`
- `/api/arb-export`

**Behavior**: Returns 403 if session exists but role is not elevated

### Resource-Level Access Control

**ARB Requests** (`src/lib/access-control.ts`):

**`requireArbRequestAccess(db, requestId, session)`**:
- **Purpose**: View/download request or attachments
- **Allowed**: Owner, household members (same address), or elevated roles
- **Returns**: `{ request }` or `{ response: 403/404 }`

**`requireArbRequestOwner(db, requestId, session, { requirePending?: true })`**:
- **Purpose**: Owner actions (cancel, edit, add/remove files)
- **Allowed**: Owner or household members only
- **Optional**: Can require status === 'pending'
- **Returns**: `{ request }` or `{ response: 403/404/400 }`

**Directory Access**:
- **Members**: Can view names/addresses, reveal contacts (if opted-in)
- **Elevated**: Can view all contacts (even if opted-out), full directory export
- **Audit**: All contact reveals logged in `directory_logs`

**Assessments/Payments**:
- **Members**: View own assessments (or primary at same address)
- **Board**: View all, record payments (requires `canRecordPayments()`)

### Page-Level Access Control

**Portal Pages** (`src/components/ProtectedPage.astro`):
- Validates session server-side
- Renders login redirect if session missing
- Uses JavaScript redirect (with noscript fallback)

**Board Pages** (`src/lib/board-context.ts`):
- `getBoardContext(Astro)` validates session and elevated role
- Returns `{ env, session, effectiveRole }` or `{ redirect }`
- Pages check `isBoardOnly()` for Board-only operations

---

## Security Features

### CSRF Protection

**Implementation**:
- CSRF token generated per session (`csrfToken` in session payload)
- Token verified on mutating endpoints (`verifyCsrfToken()`)
- Token checked from request body or header (`csrf_token` or `csrfToken`)

**Protected Endpoints**:
- ARB actions (approve, reject, set deadline, notes)
- Directory updates
- Profile updates
- Feedback submissions
- Assume-role actions
- PIM elevation/drop

### Origin Verification

**Implementation**:
- `verifyOrigin(origin, referer, expectedOrigin)` checks request origin
- Prevents cross-site request forgery
- Required for mutating API endpoints

**Headers Checked**:
- `Origin` header
- `Referer` header
- Must match site's origin

### Rate Limiting

**Implementation**: `src/lib/rate-limit.ts`

**Features**:
- IP-based rate limiting (KV store)
- Per-endpoint configuration
- Configurable limits and windows

**Protected Endpoints**:
- Login: 5 attempts per IP per 15 minutes
- Site feedback: 3 submissions per IP per day
- Directory reveals: 60 requests per IP per minute

### Account Lockout

**Implementation**: `src/lib/auth.ts`

**Features**:
- Tracks failed login attempts per email (KV store)
- Lockout after 5 failed attempts
- 15-minute lockout duration
- Automatic unlock on successful login

**Storage**: KV namespace (`CLOURHOA_USERS` or `KV`)

### Audit Logging

**Comprehensive audit trail**:
- **PIM Elevation**: `pim_elevation_log` (who elevated when)
- **Assume-Role**: `admin_assumed_role_audit` (admin/arb_board role assumptions)
- **Directory Reveals**: `directory_logs` (who viewed whose contact info)
- **ARB Actions**: `arb_audit_log` (status changes, approvals, notes)
- **Vendor Changes**: `vendor_audit_log` (create, update, delete)
- **Assessment Payments**: `assessments` table (recorded_by field)

**Access**: Board audit logs page (`/board/audit-logs`)

**Privacy**: Revealed contact info redacted; actor emails shown for accountability

---

## Implementation Details

### Key Files

**Authentication**:
- `src/lib/auth.ts`: Session management, role checks, fingerprinting, CSRF
- `src/middleware.ts`: Request-level authentication and authorization
- `src/pages/api/login.astro`: Login endpoint

**Access Control**:
- `src/lib/access-control.ts`: Resource ownership checks
- `src/lib/portal-context.ts`: Portal page context helper
- `src/lib/board-context.ts`: Board page context helper
- `src/lib/api-helpers.ts`: API route helpers (`requireSession`, `requireDb`)

**PIM**:
- `src/pages/api/pim/elevate.astro`: JIT elevation endpoint
- `src/pages/api/pim/drop.astro`: Drop elevation endpoint
- `src/pages/api/admin/assume-role.astro`: Assume-role endpoint
- `src/lib/pim-db.ts`: PIM elevation log database helpers
- `src/lib/admin-assumed-role-db.ts`: Assume-role audit log helpers

### Session Cookie Security

**Attributes**:
- `HttpOnly`: Prevents JavaScript access (XSS protection)
- `Secure`: Only sent over HTTPS (production)
- `SameSite=Lax`: CSRF protection
- `Path=/`: Available site-wide
- `Max-Age=604800`: 7-day expiration

**Signing**:
- HMAC-SHA256 with `SESSION_SECRET`
- Payload includes expiration timestamp
- Invalid signature → session rejected

### Role Assignment

**Where Roles Are Set**:
1. **KV Whitelist**: Primary source (set via board directory or manual KV update)
2. **Directory**: `owners` table has role metadata (for display)
3. **User Table**: `users` table stores role (synced from whitelist)

**Role Sync**:
- Login syncs KV whitelist role to user table
- Board directory can update roles (updates both KV and user table)
- Admin role preserved even if removed from directory

### Effective Role Flow

```
User Login
  ↓
Session Created (base role from KV)
  ↓
Request Arrives
  ↓
getEffectiveRole(session)
  ↓
  ├─ No session → 'member'
  ├─ Non-elevated → session.role
  ├─ Elevated without PIM → 'member' (requires elevation)
  ├─ Admin/arb_board with assumed_role → assumed_role
  └─ Otherwise → session.role
  ↓
Access Control Check
  ↓
  ├─ isElevatedRole(effectiveRole) → Elevated access
  ├─ isBoardOnly(effectiveRole) → Board-only access
  ├─ canApproveArb(effectiveRole) → ARB-only access
  └─ Otherwise → Member access
```

---

## Best Practices

### For Developers

1. **Always use `getEffectiveRole()`** for access control (not `session.role` directly)
2. **Check permissions at multiple layers**: Middleware + page + API endpoint
3. **Use centralized helpers**: `requireArbRequestAccess`, `requireArbRequestOwner`
4. **Verify CSRF tokens** on all mutating endpoints
5. **Log security events**: Failed logins, CSRF failures, unauthorized access attempts
6. **Test with different roles**: Ensure permissions are correctly enforced

### For Administrators

1. **Review audit logs regularly**: Check for suspicious activity
2. **Use assume-role sparingly**: Only when needed for specific tasks
3. **Drop elevated access when done**: Don't leave sessions elevated unnecessarily
4. **Monitor failed login attempts**: May indicate brute force attacks
5. **Keep role assignments current**: Remove elevated roles when members leave

### Security Considerations

1. **Session Secret**: Must be strong and kept secret (Cloudflare secrets)
2. **KV Whitelist**: Primary access control mechanism (protect KV namespace)
3. **Fingerprinting**: Helps detect session hijacking but can cause issues with VPNs/proxies
4. **PIM Elevation**: Reduces attack surface but requires user action
5. **Assume-Role**: Powerful feature, all actions are audited

---

## Related Documentation

- [SECURITY.md](../SECURITY.md): General security overview
- [DATA_ACCESS_CONTROL.md](DATA_ACCESS_CONTROL.md): Data access patterns
- [ASSUME_ROLE_HOW_TO.md](ASSUME_ROLE_HOW_TO.md): User guide for assume-role
- [ARCHITECTURE.md](ARCHITECTURE.md): System architecture overview
- [DIRECTORY_LOGS_AUDIT.md](DIRECTORY_LOGS_AUDIT.md): Directory access logging

---

## Summary

The security model implements a multi-layered approach:

1. **Authentication**: Secure session management with fingerprinting and CSRF protection
2. **RBAC**: Granular role-based permissions with elevated role checks
3. **PIM**: Just-in-time elevation and assume-role for privileged access
4. **Access Control**: Middleware, page-level, and resource-level enforcement
5. **Audit**: Comprehensive logging of all security-relevant actions

This system provides strong security while maintaining usability and transparency through comprehensive audit trails.
