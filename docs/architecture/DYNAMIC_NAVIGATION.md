# Dynamic Role-Based Navigation System

## Overview

The dynamic navigation system automatically adapts menus based on the user's effective role. When users elevate or revert their access, navigation menus update instantly to show only role-relevant links.

## Architecture

### Three-Layer System

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Menu Configurations (src/config/menus/)       │
│  - Role-specific menu definitions                       │
│  - Primary, secondary, and quick action links           │
│  - Universal links (always visible)                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Role Resolution (Server-Side)                 │
│  - Session-based role determination                     │
│  - Effective role calculation (PIM + assumption)        │
│  - Menu selection based on effective role               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: UI Components (Astro)                         │
│  - DynamicNav: Role-adaptive navigation                 │
│  - RoleSwitcher: Role status and revert control         │
│  - Automatic menu updates on role change                │
└─────────────────────────────────────────────────────────┘
```

## Components

### Menu Configuration Files

Location: `src/config/menus/`

#### `memberMenu.ts`
**Purpose**: Baseline member navigation
**Links**: Dashboard, Directory, Documents, Profile, ARB requests, Community features

```typescript
export const memberPrimaryLinks: MenuItem[] = [
  { label: 'Home', href: '/portal/dashboard' },
  { label: 'Directory', href: '/portal/directory' },
  { label: 'Documents', href: '/portal/documents' },
  { label: 'My Account', href: '/portal/profile' },
];
```

#### `adminMenu.ts`
**Purpose**: Site administration
**Links**: Admin dashboard, Feedback, SMS, Email testing, Usage, Audit logs

```typescript
export const adminPrimaryLinks: MenuItem[] = [
  { label: 'Admin Home', href: '/portal/admin' },
  { label: 'Site Feedback', href: '/portal/admin/feedback' },
  { label: 'SMS Requests', href: '/portal/admin/sms-requests' },
  { label: 'Test Email', href: '/portal/admin/test-email' },
];
```

#### `boardMenu.ts`
**Purpose**: Board governance
**Links**: Board dashboard, ARB dashboard, Directory, Dues, Meetings, Documents

```typescript
export const boardPrimaryLinks: MenuItem[] = [
  { label: 'Board Home', href: '/portal/board' },
  { label: 'ARB Dashboard', href: '/portal/arb-dashboard' },
  { label: 'Directory', href: '/board/directory' },
  { label: 'Dues', href: '/board/assessments' },
];
```

#### `arbMenu.ts`
**Purpose**: Architectural Review Board
**Links**: ARB dashboard, Library, Vendors, Meetings, Documents

```typescript
export const arbPrimaryLinks: MenuItem[] = [
  { label: 'ARB Home', href: '/portal/arb' },
  { label: 'ARB Dashboard', href: '/portal/arb-dashboard' },
  { label: 'Library', href: '/board/library' },
];
```

#### `index.ts`
**Purpose**: Central export and utility functions

```typescript
// Get menus by role
export function getPrimaryLinksForRole(role: string): MenuItem[];
export function getSecondaryLinksForRole(role: string): MenuSection[];
export function getQuickActionsForRole(role: string): MenuItem[];

// Universal links (always visible)
export const universalLinks: MenuItem[] = [
  { label: 'Help', href: '/portal/faq' },
  { label: 'Documentation', href: '/portal/docs' },
  { label: 'Public Site', href: '/' },
];
```

### UI Components

#### `DynamicNav.astro`
**Purpose**: Role-adaptive navigation component

**Props**:
- `currentPath: string` - Current page path for active state
- `effectiveRole: string` - User's effective role (determines menu)
- `staffRole?: string` - User's whitelist role (for elevation option)
- `draftCount?: number` - Badge count for draft requests
- `arbInReviewCount?: number` - Badge count for ARB reviews
- `vendorPendingCount?: number` - Badge count for vendor approvals

**Features**:
- Automatically loads correct menu based on `effectiveRole`
- Shows role badge when elevated
- Displays "Request Elevation" option for non-elevated staff
- Responsive dropdown menus with auto-close
- Dark mode toggle
- Universal links in Help dropdown

**Usage**:
```astro
---
import DynamicNav from '@/components/DynamicNav.astro';
import { getSessionFromCookie, getEffectiveRole } from '@/lib/auth';

const session = await getSessionFromCookie(/* ... */);
const effectiveRole = getEffectiveRole(session);
---

<DynamicNav
  currentPath={Astro.url.pathname}
  effectiveRole={effectiveRole}
  staffRole={session.role}
/>
```

#### `RoleSwitcher.astro`
**Purpose**: Display elevated role status and revert control

**Props**:
- `effectiveRole: string` - Current effective role
- `staffRole: string` - Whitelist role
- `elevatedUntil?: number` - PIM elevation expiry (Unix ms)
- `assumedRole?: string` - Assumed role (for admin/arb_board)
- `assumedUntil?: number` - Role assumption expiry (Unix ms)

**Features**:
- Shows current elevated role with color-coded badge
- Displays time remaining for elevation
- "Revert" button to return to member access
- Expandable help text explaining elevation
- Only visible when user is elevated

**Usage**:
```astro
---
import RoleSwitcher from '@/components/RoleSwitcher.astro';
---

<RoleSwitcher
  effectiveRole={effectiveRole}
  staffRole={session.role}
  elevatedUntil={session.elevated_until}
  assumedRole={session.assumed_role}
  assumedUntil={session.assumed_until}
/>
```

## How It Works

### Role Determination

1. **Session Check** - User logs in, session created with whitelist role
2. **PIM Elevation** - User requests elevation → `elevated_until` set (2 hours)
3. **Effective Role** - Calculated based on elevation status:
   - If `elevated_until > now` → Use whitelist role
   - If `elevated_until <= now` → Force to 'member'
   - If `assumed_role` set → Use assumed role (admin/arb_board only)
4. **Menu Selection** - `DynamicNav` receives `effectiveRole`, loads appropriate menu

### Role Change Flow

#### Elevation
```
Member → Request Elevation → Confirm → Session Updated → Page Refresh → New Menu Shown
```

1. User clicks "Request Elevation" link
2. Redirected to `/portal/request-elevated-access`
3. Confirms elevation request
4. API updates session: `elevated_until = now + 2 hours`
5. Redirects back to origin page
6. `DynamicNav` sees new `effectiveRole`, loads elevated menu
7. `RoleSwitcher` appears showing elevated status

#### Reversion
```
Elevated → Click "Revert" → Session Updated → Page Refresh → Member Menu Shown
```

1. User clicks "Revert" button in `RoleSwitcher`
2. Form posts to `/api/pim/de-elevate`
3. API clears `elevated_until` from session
4. Redirects back to page
5. `DynamicNav` sees `effectiveRole = 'member'`, loads member menu
6. `RoleSwitcher` disappears

### Role Assumption (Admin/ARB_Board)

For admin and arb_board users who can act as Board OR ARB (one at a time):

```
Admin → Elevate → Assume Board → Acts as Board → Drop Role → Assume ARB → Acts as ARB
```

1. Admin elevates to admin role
2. Clicks "Assume Board" (or "Assume ARB")
3. Session updated: `assumed_role = 'board'`, `assumed_until = now + 2 hours`
4. `effectiveRole` becomes 'board', board menu shown
5. All actions are as Board member (audited)
6. Can drop role and assume ARB instead

## Menu Types

### Primary Links
**Shown**: Main navigation bar (always visible)
**Limit**: ~4 links for optimal UI
**Example**: Home, Directory, Documents, Account

### Secondary Links
**Shown**: "More" dropdown menu
**Grouped**: By category/function
**Example**: ARB Requests section, Community section, Documents section

### Quick Actions
**Shown**: Context menus or dashboard shortcuts
**Purpose**: Fast access to common tasks
**Example**: "Record Payment", "Review Requests", "Test Email"

### Universal Links
**Shown**: "Help" dropdown (all roles)
**Always Visible**: Regardless of role
**Example**: Help, Documentation, Public Site, Sign Out

## Adding New Menu Items

### 1. Add to Menu Config

Edit `src/config/menus/[role]Menu.ts`:

```typescript
export const adminPrimaryLinks: MenuItem[] = [
  // ... existing items
  { label: 'New Feature', href: '/portal/admin/new-feature', description: 'New admin feature' },
];
```

### 2. Create the Page

Create `src/pages/portal/admin/new-feature.astro`:

```astro
---
import { requireRoles } from '@/utils/rbac';
const redirectResponse = await requireRoles(Astro, ['admin']);
if (redirectResponse) return redirectResponse;
---
```

### 3. Test

1. Login as admin
2. Elevate to admin role
3. See new link in navigation
4. Click link → page loads
5. Revert → link disappears

## Best Practices

### Menu Item Design

✅ **Do**:
- Keep labels short (1-3 words)
- Add descriptive `description` field
- Group related items in secondary menus
- Use consistent naming across roles

❌ **Don't**:
- Add more than 4 primary links
- Create deeply nested menu structures
- Use technical jargon in labels
- Duplicate links across primary/secondary

### Role-Specific Content

✅ **Do**:
- Show only links user can access
- Add badges for pending items (counts)
- Highlight current page in navigation
- Provide "Request Elevation" for staff

❌ **Don't**:
- Show disabled/grayed-out links
- Include links user can't access
- Assume role stays constant (PIM expires)
- Hardcode role checks in components

### Performance

✅ **Do**:
- Use server-side role determination
- Cache menu configs (static)
- Lazy-load dropdown menus
- Minimize re-renders

❌ **Don't**:
- Fetch role on every menu render
- Make API calls for each menu item
- Re-calculate menus client-side
- Store sensitive data in menu configs

## Testing

### Manual Testing

1. **Member Role**
   - [ ] Login as member
   - [ ] See member menu (4 primary links)
   - [ ] "More" dropdown shows member sections
   - [ ] No elevated options visible

2. **Admin Elevation**
   - [ ] Login as admin (not elevated)
   - [ ] See member menu initially
   - [ ] Click "Request Elevation"
   - [ ] Confirm elevation
   - [ ] Admin menu appears
   - [ ] RoleSwitcher shows admin badge
   - [ ] Click "Revert"
   - [ ] Member menu restored

3. **Board Elevation**
   - [ ] Login as board member
   - [ ] Elevate to board
   - [ ] Board menu appears (14 links)
   - [ ] Can access all board pages
   - [ ] Time remaining shows in RoleSwitcher
   - [ ] After 2 hours → forced to member

4. **ARB Elevation**
   - [ ] Login as ARB member
   - [ ] Elevate to ARB
   - [ ] ARB menu appears
   - [ ] Cannot access board-only pages
   - [ ] Can access shared board/ARB pages

5. **Role Assumption (arb_board)**
   - [ ] Login as arb_board
   - [ ] Elevate
   - [ ] Assume Board role
   - [ ] Board menu + "assumed" badge
   - [ ] Drop Board role
   - [ ] Assume ARB role
   - [ ] ARB menu + "assumed" badge

### Automated Testing

Create `src/tests/navigation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getPrimaryLinksForRole, getAllMenuItemsForRole } from '@/config/menus';

describe('Dynamic Navigation', () => {
  it('returns member menu for member role', () => {
    const links = getPrimaryLinksForRole('member');
    expect(links).toHaveLength(4);
    expect(links[0].label).toBe('Home');
  });

  it('returns admin menu for admin role', () => {
    const links = getPrimaryLinksForRole('admin');
    expect(links[0].href).toBe('/portal/admin');
  });

  it('returns board menu for board role', () => {
    const links = getPrimaryLinksForRole('board');
    expect(links.some(l => l.href === '/board/directory')).toBe(true);
  });

  it('includes universal links for all roles', () => {
    const memberItems = getAllMenuItemsForRole('member');
    const adminItems = getAllMenuItemsForRole('admin');
    // Both should have access to help/docs
    expect(memberItems.length).toBeGreaterThan(0);
    expect(adminItems.length).toBeGreaterThan(0);
  });
});
```

## Troubleshooting

### Menu Not Updating After Elevation

**Problem**: Menu stays the same after elevation
**Cause**: Page didn't refresh, old effectiveRole cached
**Solution**: Ensure API redirects after elevation/reversion

### Wrong Menu Shown

**Problem**: Seeing admin menu as member
**Cause**: `effectiveRole` calculated incorrectly
**Solution**: Check `getEffectiveRole()` logic, verify `elevated_until`

### RoleSwitcher Not Appearing

**Problem**: No role badge shown when elevated
**Cause**: `isElevated` check failing
**Solution**: Verify `effectiveRole !== 'member'` condition, check props passed

### Dropdown Not Closing

**Problem**: "More" dropdown stays open
**Cause**: JavaScript event listeners not attached
**Solution**: Check `is:inline` script runs, verify `portal-nav-dropdown` class

## Migration Guide

### From Old Navigation

If migrating from existing `PortalNav.astro`:

1. **Keep existing nav** for backward compatibility
2. **Test DynamicNav** on development branch
3. **Update pages** to use `DynamicNav` one role at a time:
   - Start with admin pages (least traffic)
   - Then ARB pages
   - Then board pages
   - Finally member pages
4. **Monitor** for any broken links or missing items
5. **Remove old nav** once fully migrated

### Component Replacement

**Before**:
```astro
<PortalNav currentPath={path} role={role} staffRole={staff} />
```

**After**:
```astro
<DynamicNav currentPath={path} effectiveRole={role} staffRole={staff} />
<RoleSwitcher effectiveRole={role} staffRole={staff} elevatedUntil={session.elevated_until} />
```

## Future Enhancements

- [ ] Customizable menus per user (preferences)
- [ ] Recently accessed pages in quick actions
- [ ] Search bar in navigation
- [ ] Breadcrumb navigation for deep pages
- [ ] Mobile-optimized hamburger menu
- [ ] Keyboard shortcuts for navigation
- [ ] Analytics tracking for menu usage

---

**Last Updated**: 2026-02-10
**Status**: Active Implementation
**Maintainer**: Claude Code Assistant
