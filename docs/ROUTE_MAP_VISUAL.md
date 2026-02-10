# CLRHOA Portal - Visual Route Map

## Role-Based Route Access Matrix

### Legend

- 🟢 **Full Access** - Can view and modify
- 🟡 **Read Only** - Can view but not modify
- 🔴 **No Access** - Redirected to landing zone
- ⚡ **Requires Elevation** - Must request PIM elevation
- 🔄 **Role Assumption** - Admin/ARB_Board must assume specific role

---

## Route Access by Role

### Landing Zones

| Route | Member | ARB | Board | ARB_Board | Admin | Description |
|-------|--------|-----|-------|-----------|-------|-------------|
| `/portal/dashboard` | 🟢 | 🔴⚡ | 🔴⚡ | 🔴⚡ | 🔴⚡ | Member home |
| `/portal/arb` | 🔴 | 🟢⚡ | 🔴 | 🟢⚡🔄 | 🔴 | ARB home |
| `/portal/board` | 🔴 | 🔴 | 🟢⚡ | 🟢⚡🔄 | 🔴 | Board home |
| `/portal/admin` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢⚡ | Admin home |

---

## Member Routes (All Authenticated Users)

### Core Member Features

| Route | Member | ARB | Board | ARB_Board | Admin | Description |
|-------|--------|-----|-------|-----------|-------|-------------|
| `/portal/directory` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Member directory (limited) |
| `/portal/documents` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Protected documents |
| `/portal/profile` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Profile settings |
| `/portal/my-activity` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Activity log |
| `/portal/search` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Portal search |

### ARB Requests

| Route | Member | ARB | Board | ARB_Board | Admin | Description |
|-------|--------|-----|-------|-----------|-------|-------------|
| `/portal/requests` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Request overview |
| `/portal/my-requests` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | My ARB requests |
| `/portal/arb-request` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | New ARB request |
| `/portal/arb-request/edit/[id]` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Edit request |

### Community Features

| Route | Member | ARB | Board | ARB_Board | Admin | Description |
|-------|--------|-----|-------|-----------|-------|-------------|
| `/portal/maintenance` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Maintenance schedule |
| `/portal/meetings` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Meeting calendar |
| `/portal/vendors` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Vendor list |
| `/portal/library` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Pre-approval library |
| `/portal/news` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | News feed |
| `/portal/feedback` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Submit feedback |

### Financial

| Route | Member | ARB | Board | ARB_Board | Admin | Description |
|-------|--------|-----|-------|-----------|-------|-------------|
| `/portal/assessments` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | My dues & payments |
| `/portal/assessments/receipt/[id]` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Payment receipt |

### Help & Support

| Route | Member | ARB | Board | ARB_Board | Admin | Description |
|-------|--------|-----|-------|-----------|-------|-------------|
| `/portal/docs` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Documentation |
| `/portal/faq` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | FAQ |

---

## Admin Routes (`/portal/admin/*`)

### Site Administration

| Route | Member | ARB | Board | ARB_Board | Admin | Description |
|-------|--------|-----|-------|-----------|-------|-------------|
| `/portal/admin` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢⚡ | Admin dashboard |
| `/portal/admin/feedback` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | Site feedback mgmt |
| `/portal/admin/sms-requests` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | SMS opt-in mgmt |
| `/portal/admin/test-email` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | Email testing |
| `/portal/admin/backups` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | DB backups |
| `/portal/admin/usage` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | Site analytics |
| `/portal/admin/audit-logs` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | Security logs |

### Content Management (Admin View)

| Route | Member | ARB | Board | ARB_Board | Admin | Description |
|-------|--------|-----|-------|-----------|-------|-------------|
| `/portal/admin/vendors` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | Vendor mgmt |
| `/portal/admin/maintenance` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | Maintenance mgmt |
| `/portal/admin/directory` | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 | Directory (read-only) |
| `/portal/admin/contacts` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | Contact mgmt |
| `/portal/admin/news` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | News mgmt |
| `/portal/admin/member-documents` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | Member docs upload |
| `/portal/admin/public-documents` | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | Public docs upload |

---

## Board Routes (`/board/*`)

### Governance & Operations

| Route | Member | ARB | Board | ARB_Board | Admin | Description |
|-------|--------|-----|-------|-----------|-------|-------------|
| `/board/directory` | 🔴 | 🔴 | 🟢⚡ | 🟢⚡ | 🔴 | Full directory CRUD |
| `/board/assessments` | 🔴 | 🔴 | 🟢⚡ | 🟢⚡🔄 | 🔴 | Payment recording |
| `/board/audit-logs` | 🔴 | 🔴 | 🟢⚡ | 🟢⚡ | 🔴 | Audit review |

### Shared Board/ARB Routes

| Route | Member | ARB | Board | ARB_Board | Admin | Description |
|-------|--------|-----|-------|-----------|-------|-------------|
| `/board/vendors` | 🔴 | 🟢⚡ | 🟢⚡ | 🟢⚡ | 🔴 | Vendor approvals |
| `/board/meetings` | 🔴 | 🟢⚡ | 🟢⚡ | 🟢⚡ | 🔴 | Meeting mgmt |
| `/board/maintenance` | 🔴 | 🟢⚡ | 🟢⚡ | 🟢⚡ | 🔴 | Maintenance tracking |
| `/board/feedback` | 🔴 | 🟢⚡ | 🟢⚡ | 🟢⚡ | 🔴 | Feedback review |
| `/board/contacts` | 🔴 | 🟢⚡ | 🟢⚡ | 🟢⚡ | 🔴 | Contact mgmt |
| `/board/news` | 🔴 | 🟢⚡ | 🟢⚡ | 🟢⚡ | 🔴 | News publishing |
| `/board/library` | 🔴 | 🟢⚡ | 🟢⚡ | 🟢⚡ | 🔴 | Library mgmt |
| `/board/public-documents` | 🔴 | 🟢⚡ | 🟢⚡ | 🟢⚡ | 🔴 | Public doc uploads |
| `/board/member-documents` | 🔴 | 🟢⚡ | 🟢⚡ | 🟢⚡ | 🔴 | Member doc uploads |
| `/board/backups` | 🔴 | 🟢⚡ | 🟢⚡ | 🟢⚡ | 🔴 | DB backups |

---

## ARB Routes

### ARB-Specific

| Route | Member | ARB | Board | ARB_Board | Admin | Description |
|-------|--------|-----|-------|-----------|-------|-------------|
| `/portal/arb` | 🔴 | 🟢⚡ | 🔴 | 🟢⚡🔄 | 🔴 | ARB landing zone |
| `/portal/arb-dashboard` | 🔴 | 🟢⚡ | 🟡⚡ | 🟢⚡ | 🔴 | Request review |

**Note**: Board can view ARB dashboard but cannot approve/reject (read-only). Only ARB role can perform approvals.

---

## PIM & Utility Routes

### Elevation Management

| Route | Member | ARB | Board | ARB_Board | Admin | Description |
|-------|--------|-----|-------|-----------|-------|-------------|
| `/portal/request-elevated-access` | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 | Request elevation |
| `/portal/elevation-audit` | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 | Elevation audit log |
| `/portal/assume-role-help` | 🔴 | 🔴 | 🔴 | 🟢 | 🟢 | Role assumption help |

---

## Special Rules & Notes

### Admin Role

- ✅ **Can Access**: All `/portal/admin/*` routes
- ❌ **Cannot Access**: `/board/*` routes (governance separation)
- 🟡 **Read-Only**: `/portal/admin/directory` (can view but not edit)
- 🔄 **Can Assume**: Board or ARB role (one at a time, requires elevation)

### Board Role

- ✅ **Can Access**: All `/board/*` routes
- ✅ **Can Record**: Payment tracking in `/board/assessments`
- ✅ **Can Manage**: Full directory CRUD
- 🟡 **Can View**: ARB dashboard (read-only, cannot approve)
- ⚡ **Requires**: PIM elevation (2-hour window)

### ARB Role

- ✅ **Can Access**: ARB dashboard with full approve/reject
- ✅ **Can Access**: Shared `/board/*` routes (vendors, meetings, etc.)
- ❌ **Cannot Access**: `/board/assessments` (payments)
- ❌ **Cannot Access**: `/board/directory` (full directory)
- ⚡ **Requires**: PIM elevation (2-hour window)

### ARB_Board Role (Combined)

- 🔄 **Must Assume**: Board OR ARB (one at a time)
- ⏱️ **2-Hour Timeout**: Assumed role expires, must re-assume
- ✅ **When Board**: Can record payments, manage directory
- ✅ **When ARB**: Can approve/reject requests
- 🔒 **One at a Time**: Cannot act as both simultaneously

### Member Role (Baseline)

- ✅ **Can Access**: All `/portal/*` member routes
- ✅ **Can Submit**: ARB requests, feedback, directory info
- ❌ **Cannot Access**: Any elevated routes without elevation
- 🔐 **Must Complete**: Profile (name, address, phone) before full access

---

## Elevation Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  User with elevated whitelist role (admin/board/arb)       │
│  Initial effective role: "member"                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │  Click elevated link         │
        │  in portal navigation        │
        └──────────────┬───────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │  Redirected to:              │
        │  /portal/request-elevated-   │
        │  access?return=<landing>     │
        └──────────────┬───────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │  User confirms elevation     │
        │  Session updated:            │
        │  elevated_until = now + 2hrs │
        └──────────────┬───────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │  Effective role = session.role│
        │  Can access elevated routes  │
        │  for 2 hours                 │
        └──────────────┬───────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │  After 2 hours OR manual     │
        │  de-elevation:               │
        │  Effective role = "member"   │
        └──────────────────────────────┘
```

---

## Admin/ARB_Board Role Assumption Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Admin or ARB_Board user (elevated)                         │
│  Can assume Board OR ARB role (not both)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │  Click "Assume Board" or     │
        │  "Assume ARB" button         │
        └──────────────┬───────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │  Session updated:            │
        │  assumed_role = "board"|"arb"│
        │  assumed_at = now            │
        │  assumed_until = now + 2hrs  │
        └──────────────┬───────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │  Effective role = assumed_role│
        │  Acts as Board OR ARB only   │
        │  Audit logged                │
        └──────────────┬───────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │  To switch roles:            │
        │  1. Drop current role        │
        │  2. Assume other role        │
        └──────────────────────────────┘
```

---

## API Route Protection

All API routes follow the same RBAC rules. Elevated API prefixes require elevated role:

```
ELEVATED_API_PREFIXES = [
  '/api/admin/*',
  '/api/board/*',
  '/api/owners/*',
  '/api/meetings/*',
  '/api/maintenance-update',
  '/api/public-document-upload',
  '/api/member-document',
  '/api/arb-approve',
  '/api/arb-notes',
  '/api/arb-deadline',
  '/api/arb-export',
]
```

**Exceptions** (logged-in members allowed):
- `/api/owners/me` - Update own directory info
- `/api/arb-notes` - Members add owner notes; ARB/Board add internal notes

---

**Generated**: 2026-02-10
**Maintainer**: Claude Code Assistant
**Status**: Active Reference Document
