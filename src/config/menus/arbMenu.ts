/**
 * ARB Menu Configuration
 *
 * Navigation links for ARB (Architectural Review Board) role.
 * ARB-specific operations and shared board functions.
 */

import type { MenuItem, MenuSection } from './memberMenu';

/**
 * Primary ARB navigation links
 */
export const arbPrimaryLinks: MenuItem[] = [
  { label: 'ARB Home', href: '/portal/arb', description: 'ARB dashboard' },
  { label: 'ARB Dashboard', href: '/portal/arb-dashboard', description: 'Review requests' },
  { label: 'Library', href: '/board/library', description: 'Pre-approval library' },
];

/**
 * Secondary ARB navigation (grouped by category)
 */
export const arbSecondaryLinks: MenuSection[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Vendors', href: '/board/vendors', description: 'Vendor directory' },
      { label: 'Meetings', href: '/board/meetings', description: 'Meeting calendar' },
      { label: 'Maintenance', href: '/board/maintenance', description: 'Maintenance tracking' },
      { label: 'Feedback', href: '/board/feedback', description: 'Member feedback' },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Contacts', href: '/board/contacts', description: 'Board contacts' },
      { label: 'News', href: '/board/news', description: 'News publishing' },
    ],
  },
  {
    title: 'Documents',
    items: [
      { label: 'Public Documents', href: '/board/public-documents', description: 'Public doc uploads' },
      { label: 'Member Documents', href: '/board/member-documents', description: 'Member doc uploads' },
      { label: 'Backups', href: '/board/backups', description: 'Database backups' },
    ],
  },
];

/**
 * Quick actions for ARB members
 */
export const arbQuickActions: MenuItem[] = [
  { label: 'Review Requests', href: '/portal/arb-dashboard' },
  { label: 'Manage Library', href: '/board/library' },
  { label: 'Check Vendors', href: '/board/vendors' },
];

/**
 * Get all ARB menu items (flattened)
 */
export function getAllArbMenuItems(): MenuItem[] {
  return [
    ...arbPrimaryLinks,
    ...arbSecondaryLinks.flatMap(section => section.items),
  ];
}
