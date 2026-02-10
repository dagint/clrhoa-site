/**
 * Centralised navigation link definitions.
 *
 * Every zone's link data lives here so adding / renaming / reordering a
 * link is a single-file edit.  Rendering logic (active-state classes,
 * badges, elevation conditionals) stays in the components.
 *
 * PortalNav is intentionally excluded -- its links are coupled to runtime
 * state (elevation, badge counts, dynamic hrefs).
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface NavLink {
  label: string;
  href: string;
}

export type ResourceCategory = 'main' | 'community' | 'safety' | 'legal' | 'maintenance';

export interface ResourceLink extends NavLink {
  category: ResourceCategory;
}

// ─── Resource category metadata ──────────────────────────────────────

export const resourceCategoryLabels: Record<ResourceCategory, string> = {
  main: 'Most Used',
  community: 'Community',
  safety: 'Safety',
  legal: 'Legal',
  maintenance: 'Maintenance',
};

export const resourceCategoryOrder: ResourceCategory[] = [
  'main',
  'community',
  'safety',
  'legal',
  'maintenance',
];

// ─── Public site ─────────────────────────────────────────────────────

/** Main navbar links (desktop + mobile). Resources dropdown and Contact
 *  Board CTA are rendered separately by BaseLayout. */
export const publicMainLinks: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Documents', href: '/documents' },
  { label: 'Dues', href: '/dues' },
  { label: 'Board', href: '/board' },
  { label: 'News', href: '/news' },
];

/** Resources dropdown items grouped by category. */
export const publicResourceLinks: ResourceLink[] = [
  // Most Frequently Used
  { label: 'Overview', href: '/resources', category: 'main' },
  { label: 'Emergency Contacts', href: '/resources/emergency-contacts', category: 'main' },
  { label: 'FAQ', href: '/resources/faq', category: 'main' },
  // Community
  { label: 'Local Resources', href: '/resources/local-resources', category: 'community' },
  { label: 'Internet Services', href: '/resources/internet-services', category: 'community' },
  { label: 'Vendor List', href: '/resources/vendors', category: 'community' },
  { label: 'Community Map', href: '/resources/map', category: 'community' },
  // Safety & Preparedness
  { label: 'Hurricane Preparedness', href: '/resources/hurricane', category: 'safety' },
  { label: 'Wildlife Safety', href: '/resources/wildlife-safety', category: 'safety' },
  { label: 'Water Restrictions', href: '/resources/water-restrictions', category: 'safety' },
  // Legal & Compliance
  { label: 'Florida HOA Law', href: '/resources/law', category: 'legal' },
  { label: 'Flood Insurance', href: '/resources/flood-insurance', category: 'legal' },
  // Maintenance
  { label: 'Pest Control', href: '/resources/pest-control', category: 'maintenance' },
];

/** Group resource links by category. */
export function resourcesByCategory(): Record<ResourceCategory, ResourceLink[]> {
  const grouped = {} as Record<ResourceCategory, ResourceLink[]>;
  for (const cat of resourceCategoryOrder) {
    grouped[cat] = publicResourceLinks.filter((l) => l.category === cat);
  }
  return grouped;
}

/** Footer "Quick Links" column. */
export const footerQuickLinks: NavLink[] = [
  { label: 'Documents', href: '/documents' },
  { label: 'Dues & Payment', href: '/dues' },
  { label: 'Board & Committees', href: '/board' },
  { label: 'News', href: '/news' },
  { label: 'ARB Process', href: '/arb-process' },
  { label: 'Voting & Proxy', href: '/voting' },
];

/** Footer "Resources" column. */
export const footerResourceLinks: NavLink[] = [
  { label: 'Resources Overview', href: '/resources' },
  { label: 'Emergency Contacts', href: '/resources/emergency-contacts' },
  { label: 'FAQ', href: '/resources/faq' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'About', href: '/about' },
];

// ─── Role landing zones (RBAC) ───────────────────────────────────────

/** Landing zone per role. Redirect here after PIM elevation or de-elevation. */
export const ROLE_LANDING: Record<string, string> = {
  admin: '/portal/admin',
  board: '/portal/board',
  arb: '/portal/arb',
  arb_board: '/portal/board', // arb_board elevates to board or arb; default landing is board
  member: '/portal/dashboard', // Baseline member role landing zone
};

// ─── Admin only ─────────────────────────────────────────────────────

/** Admin-only nav: all under /portal/admin/*. */
export const adminLinks: NavLink[] = [
  { label: 'Admin', href: '/portal/admin' },
  { label: 'Site feedback', href: '/portal/admin/feedback' },
  { label: 'SMS requests', href: '/portal/admin/sms-requests' },
  { label: 'Test email', href: '/portal/admin/test-email' },
  { label: 'Backups', href: '/portal/admin/backups' },
  { label: 'Site usage', href: '/portal/admin/usage' },
  { label: 'Audit logs', href: '/portal/admin/audit-logs' },
  { label: 'Vendors', href: '/portal/admin/vendors' },
  { label: 'Maintenance', href: '/portal/admin/maintenance' },
  { label: 'Directory', href: '/portal/admin/directory' },
  { label: 'Contacts', href: '/portal/admin/contacts' },
  { label: 'News', href: '/portal/admin/news' },
  { label: 'Member documents', href: '/portal/admin/member-documents' },
  { label: 'Public documents', href: '/portal/admin/public-documents' },
];

// ─── Board only ─────────────────────────────────────────────────────

/** Board-only nav: board dashboard, ARB dashboard, directory, dues, vendors, meetings, maintenance, feedback, contacts, news, library, documents, audit logs, backups. */
export const boardLinks: NavLink[] = [
  { label: 'Board', href: '/portal/board' },
  { label: 'ARB Dashboard', href: '/portal/arb-dashboard' },
  { label: 'Directory', href: '/board/directory' },
  { label: 'Dues', href: '/board/assessments' },
  { label: 'Vendors', href: '/board/vendors' },
  { label: 'Meetings', href: '/board/meetings' },
  { label: 'Maintenance', href: '/board/maintenance' },
  { label: 'Feedback', href: '/board/feedback' },
  { label: 'Contacts', href: '/board/contacts' },
  { label: 'News', href: '/board/news' },
  { label: 'Library', href: '/board/library' },
  { label: 'Public documents', href: '/board/public-documents' },
  { label: 'Member documents', href: '/board/member-documents' },
  { label: 'Audit logs', href: '/board/audit-logs' },
  { label: 'Backups', href: '/board/backups' },
];

// ─── ARB only ────────────────────────────────────────────────────────

/** ARB-only nav: ARB dashboard, vendors, meetings, maintenance, feedback, contacts, news, library, documents, backups. */
export const arbLinks: NavLink[] = [
  { label: 'ARB', href: '/portal/arb' },
  { label: 'ARB Dashboard', href: '/portal/arb-dashboard' },
  { label: 'Vendors', href: '/board/vendors' },
  { label: 'Meetings', href: '/board/meetings' },
  { label: 'Maintenance', href: '/board/maintenance' },
  { label: 'Feedback', href: '/board/feedback' },
  { label: 'Contacts', href: '/board/contacts' },
  { label: 'News', href: '/board/news' },
  { label: 'Library', href: '/board/library' },
  { label: 'Member documents', href: '/board/member-documents' },
  { label: 'Public documents', href: '/board/public-documents' },
  { label: 'Backups', href: '/board/backups' },
];

// ─── Portal navigation ──────────────────────────────────────────────

/** Main portal navigation links (always visible). */
export const portalMainLinks: NavLink[] = [
  { label: 'Home', href: '/portal/dashboard' },
  { label: 'Directory', href: '/portal/directory' },
  { label: 'Documents', href: '/portal/documents' },
  { label: 'My account', href: '/portal/profile' },
];

/** Portal "More" dropdown links (member-level). */
export const portalMoreLinks: NavLink[] = [
  { label: 'Requests', href: '/portal/requests' },
  { label: 'My requests (ARB)', href: '/portal/my-requests' },
  { label: 'My activity', href: '/portal/my-activity' },
  { label: 'New ARB request', href: '/portal/arb-request' },
  { label: 'Maintenance', href: '/portal/maintenance' },
  { label: 'Meetings', href: '/portal/meetings' },
  { label: 'Vendors', href: '/portal/vendors' },
  { label: 'Pre-approval library', href: '/portal/library' },
  { label: 'Dues', href: '/portal/assessments' },
  { label: 'Feedback', href: '/portal/feedback' },
];

/** Portal "Help" dropdown links. */
export const portalHelpLinks: NavLink[] = [
  { label: 'News & announcements', href: '/portal/news' },
  { label: 'Documentation', href: '/portal/docs' },
  { label: 'FAQ', href: '/portal/faq' },
];

/**
 * Portal elevated link: one per staff role. Shown when user has elevated whitelist role.
 * Href is role's landing zone; when not elevated, link goes to request-elevated-access?return=<landing>.
 */
export function getPortalElevatedLink(staffRole: string): { label: string; href: string } | null {
  const r = staffRole?.toLowerCase();
  if (r === 'admin') return { label: 'Admin', href: ROLE_LANDING.admin };
  if (r === 'board') return { label: 'Board', href: ROLE_LANDING.board };
  if (r === 'arb' || r === 'arb_board') return { label: r === 'arb' ? 'ARB' : 'Board / ARB', href: ROLE_LANDING[r] ?? ROLE_LANDING.board };
  return null;
}
