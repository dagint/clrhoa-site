/**
 * Member Menu Configuration
 *
 * Navigation links for baseline member role.
 * These links are visible to all authenticated users.
 */

export interface MenuItem {
  label: string;
  href: string;
  badge?: number | string;
  description?: string;
}

export interface MenuSection {
  title?: string;
  items: MenuItem[];
}

/**
 * Primary navigation links (always visible in main nav bar)
 */
export const memberPrimaryLinks: MenuItem[] = [
  { label: 'Home', href: '/portal/dashboard', description: 'Member dashboard' },
  { label: 'Directory', href: '/portal/directory', description: 'HOA member directory' },
  { label: 'Documents', href: '/portal/documents', description: 'Protected documents' },
  { label: 'My Account', href: '/portal/profile', description: 'Profile settings' },
];

/**
 * Secondary navigation links (in "More" dropdown)
 */
export const memberSecondaryLinks: MenuSection[] = [
  {
    title: 'ARB Requests',
    items: [
      { label: 'Request Status', href: '/portal/requests', description: 'View all requests' },
      { label: 'My Requests', href: '/portal/my-requests', description: 'My ARB submissions' },
      { label: 'New Request', href: '/portal/arb-request', description: 'Submit new ARB request' },
    ],
  },
  {
    title: 'Community',
    items: [
      { label: 'Maintenance', href: '/portal/maintenance', description: 'Maintenance schedule' },
      { label: 'Meetings', href: '/portal/meetings', description: 'Meeting calendar' },
      { label: 'Vendors', href: '/portal/vendors', description: 'Recommended vendors' },
      { label: 'Library', href: '/portal/library', description: 'Pre-approval library' },
    ],
  },
  {
    title: 'My Account',
    items: [
      { label: 'Dues', href: '/portal/assessments', description: 'Payment history' },
      { label: 'Feedback', href: '/portal/feedback', description: 'Submit feedback' },
      { label: 'Activity', href: '/portal/my-activity', description: 'My activity log' },
    ],
  },
];

/**
 * Help & Support links
 */
export const memberHelpLinks: MenuItem[] = [
  { label: 'News & Announcements', href: '/portal/news' },
  { label: 'Documentation', href: '/portal/docs' },
  { label: 'FAQ', href: '/portal/faq' },
];

/**
 * Get all member menu items (flattened)
 */
export function getAllMemberMenuItems(): MenuItem[] {
  return [
    ...memberPrimaryLinks,
    ...memberSecondaryLinks.flatMap(section => section.items),
    ...memberHelpLinks,
  ];
}
