## Dynamic Route Guards

Complete guide to implementing permission-based route protection in Astro.

## Overview

Route guards dynamically enforce permission-based access control using stored permissions from the database. Guards run server-side before pages render, ensuring security at the routing level.

**Key Features:**
- ✅ Server-side enforcement (before page renders)
- ✅ Dynamic permission checking (from database)
- ✅ Automatic redirects to access-denied page
- ✅ Optional client-side helpers for UI elements
- ✅ Type-safe guard functions

## Server-Side Route Guards

### Basic Usage

```astro
---
import { requirePermission } from '@/utils/routeGuards';

// Require read access to view this page
const guard = await requirePermission(Astro, 'read');
if (guard) return guard;

// Page content only renders if authorized
---
<h1>Protected Page</h1>
<p>You have access!</p>
```

### Require Write Access

```astro
---
import { requireWrite } from '@/utils/routeGuards';

// Shorthand for requirePermission(Astro, 'write')
const guard = await requireWrite(Astro);
if (guard) return guard;
---
<h1>Edit Page</h1>
<form><!-- Edit form --></form>
```

### Custom Redirect

```astro
---
import { requirePermission } from '@/utils/routeGuards';

// Redirect to custom page instead of /portal/access-denied
const guard = await requirePermission(Astro, 'write', '/portal/dashboard');
if (guard) return guard;
---
```

### Check Without Redirect

```astro
---
import { checkPermission } from '@/utils/routeGuards';

const check = await checkPermission(Astro, 'write');

if (!check.allowed) {
  // Custom handling
  return new Response('Unauthorized', { status: 403 });
}

// Or show read-only view
const isReadOnly = check.currentLevel === 'read';
---
<h1>Page {isReadOnly && '(Read-Only)'}</h1>
{isReadOnly ? (
  <p>You can view but not edit this content.</p>
) : (
  <button>Edit</button>
)}
```

### Load Data Only If Authorized

```astro
---
import { withPermissionCheck } from '@/utils/routeGuards';

const result = await withPermissionCheck(Astro, 'read', async () => {
  // This only runs if user has read access
  const data = await fetchExpensiveData();
  return { data };
});

// If not authorized, result is a Response (redirect)
if (result instanceof Response) return result;

// Otherwise, result is the data
const { data } = result;
---
<div>{JSON.stringify(data)}</div>
```

## Guard Functions Reference

### `requirePermission(Astro, level, redirectTo?)`

**Purpose**: Require specific permission level for current route.

**Parameters:**
- `Astro`: Astro global object
- `level`: `'read'` or `'write'`
- `redirectTo`: Optional custom redirect path

**Returns**: `Response` if unauthorized (redirect), `null` if authorized

**Example:**
```typescript
const guard = await requirePermission(Astro, 'write');
if (guard) return guard;
```

---

### `requireWrite(Astro)`

**Purpose**: Shorthand for requiring write access.

**Example:**
```typescript
const guard = await requireWrite(Astro);
if (guard) return guard;
```

---

### `requireRead(Astro)`

**Purpose**: Shorthand for requiring read access.

**Example:**
```typescript
const guard = await requireRead(Astro);
if (guard) return guard;
```

---

### `checkPermission(Astro, level)`

**Purpose**: Check permission without redirecting.

**Returns**: `PermissionCheckResult` object with details

**Example:**
```typescript
const check = await checkPermission(Astro, 'write');
// {
//   allowed: boolean,
//   currentLevel: 'none' | 'read' | 'write' | null,
//   requiredLevel: 'read' | 'write',
//   userRole: string | null,
//   path: string
// }
```

---

### `withPermissionCheck(Astro, level, getData)`

**Purpose**: Protect route and load data only if authorized.

**Parameters:**
- `Astro`: Astro global
- `level`: Required permission
- `getData`: Async function to load data

**Returns**: Data if authorized, Response if not

**Example:**
```typescript
const result = await withPermissionCheck(Astro, 'read', async () => {
  return { items: await fetchItems() };
});

if (result instanceof Response) return result;
const { items } = result;
```

---

### `canUserPerformAction(Astro, action)`

**Purpose**: Check if user can perform specific action on current route.

**Parameters:**
- `Astro`: Astro global
- `action`: `'view'` | `'create'` | `'edit'` | `'delete'`

**Returns**: `Promise<boolean>`

**Example:**
```astro
---
const canEdit = await canUserPerformAction(Astro, 'edit');
const canDelete = await canUserPerformAction(Astro, 'delete');
---
{canEdit && <button>Edit</button>}
{canDelete && <button>Delete</button>}
```

**Action Mapping:**
- `view` → requires `read` permission
- `create`, `edit`, `delete` → require `write` permission

---

### `getPermissionDetails(Astro)`

**Purpose**: Get detailed permission info for debugging or display.

**Returns**: Permission details object

**Example:**
```astro
---
const details = await getPermissionDetails(Astro);
---
<dl>
  <dt>Your Role:</dt>
  <dd>{details.role}</dd>
  <dt>Access Level:</dt>
  <dd>{details.level}</dd>
  <dt>Can View:</dt>
  <dd>{details.canView ? 'Yes' : 'No'}</dd>
  <dt>Can Edit:</dt>
  <dd>{details.canEdit ? 'Yes' : 'No'}</dd>
</dl>
```

## Client-Side Helpers (Optional)

For showing/hiding UI elements based on permissions.

### Initialize Permission UI

```astro
---
import { getCurrentUser } from '@/utils/rbac';
const user = await getCurrentUser(Astro);
---

<!-- HTML with data-permission attributes -->
<button data-permission="write">Edit</button>
<button data-permission="write" data-permission-hide="disable">Delete</button>

<script>
  import { initPermissionUI } from '@/utils/clientPermissions';

  // Hide/show/disable elements based on permissions
  initPermissionUI('{user?.effectiveRole}');
</script>
```

**HTML Attributes:**
- `data-permission`: Required permission level (`read` or `write`)
- `data-permission-path`: Optional path to check (defaults to current)
- `data-permission-hide`: How to hide (`display`, `visibility`, `disable`)

**Hide Modes:**
- `display` (default): Sets `display: none`
- `visibility`: Sets `visibility: hidden`
- `disable`: Disables button/input

### Manual Permission Check

```astro
<script>
  import { hasClientPermission } from '@/utils/clientPermissions';

  const editButton = document.getElementById('edit-btn');
  const canEdit = await hasClientPermission('board', '/board/meetings', 'write');

  if (canEdit) {
    editButton.addEventListener('click', handleEdit);
  } else {
    editButton.disabled = true;
  }
</script>
```

### Automatic Refresh

```astro
<script>
  import { setupPermissionRefresh } from '@/utils/clientPermissions';

  // Re-fetch permissions every 15 minutes
  const cleanup = setupPermissionRefresh('member', (newPermissions) => {
    console.log('Permissions updated:', newPermissions);
    // Update UI if needed
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);
</script>
```

## Complete Examples

### Example 1: Board Meetings Page (Write Required)

```astro
---
// src/pages/board/meetings.astro
export const prerender = false;

import BoardLayout from '@/layouts/BoardLayout.astro';
import { requireWrite } from '@/utils/routeGuards';
import { canUserPerformAction } from '@/utils/routeGuards';

// Require write access
const guard = await requireWrite(Astro);
if (guard) return guard;

// Check specific actions
const canCreate = await canUserPerformAction(Astro, 'create');
const canDelete = await canUserPerformAction(Astro, 'delete');

// Load data
const meetings = await fetchMeetings();
---

<BoardLayout title="Meetings">
  <div>
    {canCreate && (
      <a href="/board/meetings/new" class="btn">Create Meeting</a>
    )}

    {meetings.map((meeting) => (
      <div>
        <h3>{meeting.title}</h3>
        <a href={`/board/meetings/${meeting.id}/edit`}>Edit</a>
        {canDelete && (
          <button data-delete-id={meeting.id}>Delete</button>
        )}
      </div>
    ))}
  </div>
</BoardLayout>
```

---

### Example 2: Dashboard (Read Required)

```astro
---
// src/pages/portal/dashboard.astro
export const prerender = false;

import PortalLayout from '@/layouts/PortalLayout.astro';
import { requireRead } from '@/utils/routeGuards';

// Require at least read access
const guard = await requireRead(Astro);
if (guard) return guard;

const user = await getCurrentUser(Astro);
---

<PortalLayout title="Dashboard">
  <h1>Welcome, {user?.name}!</h1>
  <p>You have access to this dashboard.</p>
</PortalLayout>
```

---

### Example 3: Mixed Read/Write Page

```astro
---
// src/pages/portal/directory.astro
export const prerender = false;

import { checkPermission } from '@/utils/routeGuards';

// Check permission level
const check = await checkPermission(Astro, 'read');

if (!check.allowed) {
  // No read access at all
  return Astro.redirect('/portal/access-denied');
}

const isReadOnly = check.currentLevel === 'read';
const canEdit = check.currentLevel === 'write';

const members = await fetchMembers();
---

<h1>Directory {isReadOnly && '(Read-Only)'}</h1>

{isReadOnly && (
  <div class="alert-info">
    You have read-only access. Contact a board member to edit the directory.
  </div>
)}

<table>
  {members.map((member) => (
    <tr>
      <td>{member.name}</td>
      <td>
        {canEdit && (
          <a href={`/portal/directory/${member.id}/edit`}>Edit</a>
        )}
      </td>
    </tr>
  ))}
</table>

{canEdit && (
  <a href="/portal/directory/new" class="btn">Add Member</a>
)}
```

---

### Example 4: With Data Loading

```astro
---
import { withPermissionCheck } from '@/utils/routeGuards';

// Only fetch data if authorized
const result = await withPermissionCheck(Astro, 'read', async () => {
  const [stats, recentActivity] = await Promise.all([
    fetchStats(),
    fetchRecentActivity(),
  ]);

  return { stats, recentActivity };
});

// If unauthorized, result is Response - return it to redirect
if (result instanceof Response) return result;

// Otherwise, we have the data
const { stats, recentActivity } = result;
---

<h1>Analytics</h1>
<div>
  <h2>Stats</h2>
  <pre>{JSON.stringify(stats, null, 2)}</pre>

  <h2>Recent Activity</h2>
  <ul>
    {recentActivity.map((item) => (
      <li>{item.description}</li>
    ))}
  </ul>
</div>
```

## Access Denied Page

When a guard fails, users are redirected to `/portal/access-denied` with query parameters:

**URL Format:**
```
/portal/access-denied?path=/board/meetings&required=write
```

**Query Parameters:**
- `path`: The route they tried to access
- `required`: The permission level required
- `reason`: Optional custom reason message

The access denied page shows:
- ✅ Clear explanation of why access was denied
- ✅ Current role and required permission level
- ✅ Actions (Go to Dashboard, Go Back)
- ✅ Help text with next steps
- ✅ Contextual suggestions (request elevation, contact admin)

## Security Notes

### Server-Side Only

**Route guards run server-side** before page renders. This means:
- ✅ Pages never render for unauthorized users
- ✅ No sensitive data sent to browser
- ✅ Client-side bypasses are impossible

### Client-Side is UX Only

Client-side helpers (`clientPermissions.ts`) are **for user experience only**:
- Show/hide buttons based on permissions
- Display permission status
- Avoid unnecessary API calls

**Never rely on client-side checks for security.** Always use server-side guards.

### Permission Caching

- Server-side: No caching (always checks database/static config)
- Client-side: 15-minute cache in localStorage (UX only)

### Static Fallback

When database is unavailable, guards fall back to `PROTECTED_ROUTES` configuration. This ensures:
- ✅ Local development works without D1
- ✅ Same security rules apply
- ✅ No bypass of authorization

## Troubleshooting

### Guard redirects even though I have permission

**Check:**
1. Is your role elevated? (PIM may have expired)
2. Does the database have correct permissions?
3. Check admin UI: `/portal/admin/permissions`

### Client-side helper not working

**Check:**
1. Did you call `initPermissionUI(role)`?
2. Are `data-permission` attributes correct?
3. Check browser console for errors
4. Is the API endpoint `/api/permissions/for-role` working?

### Page shows "Access Denied" but I'm admin

**Check:**
1. Is your admin role elevated? Visit `/portal/request-elevated-access`
2. Admin PIM elevation lasts 2 hours - may need to re-elevate

## Best Practices

### ✅ Do

- **Always use server-side guards** for security
- **Use client-side helpers** for improved UX
- **Check specific actions** when different buttons need different permissions
- **Provide clear feedback** when users lack access
- **Test with different roles** to ensure guards work correctly

### ❌ Don't

- **Don't skip server-side guards** - client-side is not security
- **Don't hard-code permissions** - use the database/API
- **Don't show sensitive data** then hide it with CSS
- **Don't forget to handle read-only** vs write scenarios
- **Don't use guards on public pages** - only on `/portal/*` and `/board/*`

## Migration Guide

### From Old RBAC System

**Before (old system):**
```astro
---
import { requireRoles } from '@/utils/rbac';

const guard = await requireRoles(Astro, ['board', 'admin']);
if (guard) return guard;
---
```

**After (new system):**
```astro
---
import { requireWrite } from '@/utils/routeGuards';

const guard = await requireWrite(Astro);
if (guard) return guard;
---
```

**Key Differences:**
- Old: Hard-coded role lists
- New: Dynamic permission levels from database
- Old: Role-based (`requireRoles(['board'])`)
- New: Permission-based (`requireWrite()`)

### Gradual Migration

You can use both systems simultaneously:
1. Keep existing `requireRoles()` for stability
2. Add new `requirePermission()` alongside
3. Test new guards thoroughly
4. Remove old `requireRoles()` once confident

---

**Last Updated**: 2026-02-10
**Status**: Active Implementation
**Maintainer**: Claude Code Assistant
