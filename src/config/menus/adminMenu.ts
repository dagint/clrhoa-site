/**
 * Admin Menu Configuration
 *
 * Navigation links for Admin role.
 * Site administration and operational management.
 */

import type { MenuItem, MenuSection } from './memberMenu';

/**
 * Primary admin navigation links
 */
export const adminPrimaryLinks: MenuItem[] = [
  { label: 'Admin Home', href: '/portal/admin', description: 'Admin dashboard' },
  { label: 'Site Feedback', href: '/portal/admin/feedback', description: 'Member feedback' },
  { label: 'SMS Requests', href: '/portal/admin/sms-requests', description: 'SMS opt-in management' },
  { label: 'Test Email', href: '/portal/admin/test-email', description: 'Email delivery testing' },
];

/**
 * Secondary admin navigation (grouped by category)
 */
export const adminSecondaryLinks: MenuSection[] = [
  {
    title: 'Site Management',
    items: [
      { label: 'Site Usage', href: '/portal/admin/usage', description: 'Analytics and usage stats' },
      { label: 'Audit Logs', href: '/portal/admin/audit-logs', description: 'Security logs' },
      { label: 'Backups', href: '/portal/admin/backups', description: 'Database backups' },
    ],
  },
  {
    title: 'Content Management',
    items: [
      { label: 'Vendors', href: '/portal/admin/vendors', description: 'Vendor management' },
      { label: 'Maintenance', href: '/portal/admin/maintenance', description: 'Maintenance tracking' },
      { label: 'Contacts', href: '/portal/admin/contacts', description: 'Board contacts' },
      { label: 'News', href: '/portal/admin/news', description: 'News management' },
    ],
  },
  {
    title: 'Documents',
    items: [
      { label: 'Directory', href: '/portal/admin/directory', description: 'Member directory (read-only)' },
      { label: 'Member Documents', href: '/portal/admin/member-documents', description: 'Protected documents' },
      { label: 'Public Documents', href: '/portal/admin/public-documents', description: 'Public documents' },
    ],
  },
];

/**
 * Quick actions for admin
 */
export const adminQuickActions: MenuItem[] = [
  { label: 'Test Email Delivery', href: '/portal/admin/test-email' },
  { label: 'View Audit Logs', href: '/portal/admin/audit-logs' },
  { label: 'Check Site Usage', href: '/portal/admin/usage' },
];

/**
 * Get all admin menu items (flattened)
 */
export function getAllAdminMenuItems(): MenuItem[] {
  return [
    ...adminPrimaryLinks,
    ...adminSecondaryLinks.flatMap(section => section.items),
  ];
}
