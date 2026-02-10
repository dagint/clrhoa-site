/**
 * Board Menu Configuration
 *
 * Navigation links for Board role.
 * HOA governance and board-specific operations.
 */

import type { MenuItem, MenuSection } from './memberMenu';

/**
 * Primary board navigation links
 */
export const boardPrimaryLinks: MenuItem[] = [
  { label: 'Board Home', href: '/portal/board', description: 'Board dashboard' },
  { label: 'ARB Dashboard', href: '/portal/arb-dashboard', description: 'Review ARB requests' },
  { label: 'Directory', href: '/board/directory', description: 'Manage member directory' },
  { label: 'Dues', href: '/board/assessments', description: 'Payment tracking' },
];

/**
 * Secondary board navigation (grouped by category)
 */
export const boardSecondaryLinks: MenuSection[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Vendors', href: '/board/vendors', description: 'Vendor approvals' },
      { label: 'Meetings', href: '/board/meetings', description: 'Meeting management' },
      { label: 'Maintenance', href: '/board/maintenance', description: 'Maintenance requests' },
      { label: 'Feedback', href: '/board/feedback', description: 'Member feedback' },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Contacts', href: '/board/contacts', description: 'Board contacts' },
      { label: 'News', href: '/board/news', description: 'Publish news' },
      { label: 'Library', href: '/board/library', description: 'Pre-approval library' },
    ],
  },
  {
    title: 'Documents',
    items: [
      { label: 'Public Documents', href: '/board/public-documents', description: 'Public doc uploads' },
      { label: 'Member Documents', href: '/board/member-documents', description: 'Member doc uploads' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Audit Logs', href: '/board/audit-logs', description: 'Security audit logs' },
      { label: 'Backups', href: '/board/backups', description: 'Database backups' },
    ],
  },
];

/**
 * Quick actions for board members
 */
export const boardQuickActions: MenuItem[] = [
  { label: 'Review ARB Requests', href: '/portal/arb-dashboard' },
  { label: 'Record Payment', href: '/board/assessments' },
  { label: 'Manage Directory', href: '/board/directory' },
];

/**
 * Get all board menu items (flattened)
 */
export function getAllBoardMenuItems(): MenuItem[] {
  return [
    ...boardPrimaryLinks,
    ...boardSecondaryLinks.flatMap(section => section.items),
  ];
}
