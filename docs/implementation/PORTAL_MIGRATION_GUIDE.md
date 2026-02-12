# Portal Page Migration Guide

## Converting Pages to New Gmail-Style Layout

This guide shows how to convert any remaining portal page to use the new `PortalPage` wrapper component with sidebar navigation and profile dropdown.

## ✅ Already Converted

The following pages have been fully updated:
- `/portal/dashboard.astro`
- `/portal/documents.astro`
- `/portal/directory.astro`
- `/portal/vendors.astro`

## 📋 Pattern to Follow

### Step 1: Update Imports

**OLD:**
```astro
import PortalLayout from '../../layouts/PortalLayout.astro';
import ProtectedPage from '../../components/ProtectedPage.astro';
import PortalNav from '../../components/PortalNav.astro';
import { getPortalContext } from '../../lib/portal-context';
import { listArbRequestsByHousehold } from '../../lib/arb-db';
// ... other imports
```

**NEW:**
```astro
import PortalLayout from '../../layouts/PortalLayout.astro';
import PortalPage from '../../components/PortalPage.astro';
import { getPortalContext } from '../../lib/portal-context';
import { getPortalBadgeCounts } from '../../lib/portal-badge-counts';
// ... other imports (remove ProtectedPage and PortalNav)
```

### Step 2: Get Badge Counts

**OLD:**
```astro
const allRequests = db ? await listArbRequestsByHousehold(db, session.email) : [];
const draftCount = allRequests.filter((r) => r.status === 'pending').length;
// ... lots of manual count logic
```

**NEW:**
```astro
const { env, session, effectiveRole } = await getPortalContext(Astro);
if (!session) return Astro.redirect('/portal/login');

const { email, role, name } = session;
const db = env?.DB;

// Get all badge counts in one call!
const badges = await getPortalBadgeCounts(db, email, role, name);
```

### Step 3: Replace Layout Structure

**OLD:**
```astro
<PortalLayout title="Page Title">
  <ProtectedPage>
    <div class="min-h-screen portal-theme-bg">
      <PortalNav currentPath="/portal/page" draftCount={draftCount} ... />
      <main class="max-w-4xl mx-auto px-4 py-8">
        <!-- Your content -->
      </main>
    </div>
  </ProtectedPage>
</PortalLayout>
```

**NEW:**
```astro
<PortalLayout title="Page Title">
  <PortalPage
    currentPath="/portal/page"
    pageTitle="Page Title"
    userName={badges.displayName ?? undefined}
    userEmail={email}
    effectiveRole={effectiveRole}
    draftCount={badges.draftCount}
    role={effectiveRole}
    staffRole={role ?? ''}
    arbInReviewCount={badges.arbInReviewCount}
    vendorPendingCount={badges.vendorPendingCount}
    maintenanceOpenCount={badges.maintenanceOpenCount}
    meetingsRsvpCount={badges.meetingsRsvpCount}
    feedbackDueCount={badges.feedbackDueCount}
  >
    <!-- Your content (no need for extra wrapper divs) -->
  </PortalPage>
</PortalLayout>
```

### Step 4: Improve Typography for Elderly Users

Update text sizes throughout your content:

**Headings:**
- `text-2xl` → `text-3xl` (main h1)
- `text-xl` → `text-2xl` (section headings)
- `text-lg` → `text-xl` (sub-headings)

**Body Text:**
- `text-sm` → `text-base` (regular text)
- `text-base` → `text-lg` (intro/important text)

**Buttons:**
- Add `py-3` for height (instead of `py-2`)
- Use `text-base` or `text-lg` for button text

**Form Inputs:**
- Add `py-3` for height
- Use `text-base` for input text

## 🎨 Design Improvements Checklist

When updating a page, also apply these elderly-friendly improvements:

- [ ] **Larger text**: Min 16px (text-base) for body, 18px+ for important text
- [ ] **Bigger buttons**: Min 44px height for touch targets
- [ ] **More whitespace**: Use `mb-8` between sections (instead of `mb-6`)
- [ ] **Larger cards**: Use `p-6 sm:p-8` for card padding
- [ ] **High contrast**: Ensure text is dark enough on backgrounds
- [ ] **Clear hierarchy**: Use consistent heading sizes
- [ ] **Icons with labels**: Don't rely on icons alone
- [ ] **Generous padding**: Use `px-6 py-4` for clickable areas

## 📝 Complete Example

Here's a minimal working example for a new page:

```astro
---
export const prerender = false;

import PortalLayout from '../../layouts/PortalLayout.astro';
import PortalPage from '../../components/PortalPage.astro';
import { getPortalContext } from '../../lib/portal-context';
import { getPortalBadgeCounts } from '../../lib/portal-badge-counts';

const { env, session, effectiveRole } = await getPortalContext(Astro);
if (!session) return Astro.redirect('/portal/login');

const { email, role, name } = session;
const db = env?.DB;
const badges = await getPortalBadgeCounts(db, email, role, name);

// Your page-specific data loading here
---

<PortalLayout title="My Page | Member Portal">
  <PortalPage
    currentPath="/portal/my-page"
    pageTitle="My Page"
    userName={badges.displayName ?? undefined}
    userEmail={email}
    effectiveRole={effectiveRole}
    draftCount={badges.draftCount}
    role={effectiveRole}
    staffRole={role ?? ''}
    arbInReviewCount={badges.arbInReviewCount}
    vendorPendingCount={badges.vendorPendingCount}
    maintenanceOpenCount={badges.maintenanceOpenCount}
    meetingsRsvpCount={badges.meetingsRsvpCount}
    feedbackDueCount={badges.feedbackDueCount}
  >
    <!-- Welcome Card -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-8">
      <h1 class="text-3xl font-heading font-bold text-clr-green mb-3">
        My Page Title
      </h1>
      <p class="text-gray-600 text-lg">
        Page description goes here.
      </p>
    </div>

    <!-- Your content sections -->
    <div class="space-y-8">
      <!-- Content here -->
    </div>
  </PortalPage>
</PortalLayout>
```

## 🚀 Quick Reference

### Component Props

All props for `<PortalPage>`:

```typescript
interface PortalPageProps {
  currentPath: string;           // e.g., "/portal/page"
  pageTitle: string;              // Shown in header
  userName?: string;              // User's display name
  userEmail: string;              // Required
  effectiveRole?: string;         // member/board/arb/admin
  draftCount?: number;            // ARB draft count
  role?: string;                  // Effective role
  staffRole?: string;             // Whitelist role
  arbInReviewCount?: number;      // ARB in review
  vendorPendingCount?: number;    // Vendor submissions
  maintenanceOpenCount?: number;  // Open maintenance
  meetingsRsvpCount?: number;     // Meetings to RSVP
  feedbackDueCount?: number;      // Feedback due
}
```

### Helper Function

```typescript
// Returns all badge counts in one call
const badges = await getPortalBadgeCounts(
  db,              // D1Database | undefined
  email,           // string
  role,            // string | undefined
  sessionName      // string | null | undefined
);

// Returns:
{
  displayName: string | null,
  draftCount: number,
  arbInReviewCount: number,
  arbPendingCount: number,
  vendorPendingCount: number,
  maintenanceOpenCount: number,
  meetingsRsvpCount: number,
  feedbackDueCount: number
}
```

## 📚 Reference Pages

Look at these fully-updated pages for examples:
- **Simple page**: `/portal/documents.astro`
- **Form page**: `/portal/vendors.astro`
- **Table page**: `/portal/directory.astro`
- **Dashboard**: `/portal/dashboard.astro`

## ⚠️ Common Mistakes to Avoid

1. **Don't forget** to import `PortalPage` instead of `ProtectedPage`
2. **Don't forget** to remove `PortalNav` import and usage
3. **Don't forget** to use the `getPortalBadgeCounts` helper
4. **Don't forget** to increase text sizes for elderly users
5. **Don't forget** to add generous padding/spacing

## 🎯 Pages Still Needing Migration

Check these pages and update as needed:
- `/portal/profile.astro`
- `/portal/arb-request.astro`
- `/portal/maintenance.astro`
- `/portal/meetings.astro`
- `/portal/requests.astro` or `/portal/my-requests.astro`
- `/portal/feedback.astro`
- `/portal/assessments.astro`
- `/portal/news.astro`
- All `/portal/admin/*` pages
- All `/board/*` pages

---

**Questions?** Reference the completed pages or check the component source code:
- `src/components/PortalPage.astro`
- `src/components/PortalSidebar.astro`
- `src/components/PortalHeader.astro`
- `src/lib/portal-badge-counts.ts`
