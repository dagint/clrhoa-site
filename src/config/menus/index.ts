/**
 * Menu Configuration Index
 *
 * Central export point for all role-based menu configurations.
 * Provides utility functions to get menus by role.
 */

import type { MenuItem, MenuSection } from './memberMenu';
import { memberPrimaryLinks, memberSecondaryLinks, memberHelpLinks, getAllMemberMenuItems } from './memberMenu';
import { adminPrimaryLinks, adminSecondaryLinks, adminQuickActions, getAllAdminMenuItems } from './adminMenu';
import { boardPrimaryLinks, boardSecondaryLinks, boardQuickActions, getAllBoardMenuItems } from './boardMenu';
import { arbPrimaryLinks, arbSecondaryLinks, arbQuickActions, getAllArbMenuItems } from './arbMenu';

export type { MenuItem, MenuSection };

/**
 * Universal links - always visible regardless of role
 */
export const universalLinks: MenuItem[] = [
  { label: 'Help', href: '/portal/faq', description: 'Get help' },
  { label: 'Documentation', href: '/portal/docs', description: 'Portal documentation' },
  { label: 'Public Site', href: '/', description: 'Back to public site' },
];

/**
 * Get primary navigation links for a given role
 */
export function getPrimaryLinksForRole(role: string): MenuItem[] {
  const r = role?.toLowerCase();
  switch (r) {
    case 'admin':
      return adminPrimaryLinks;
    case 'board':
    case 'arb_board':
      return boardPrimaryLinks;
    case 'arb':
      return arbPrimaryLinks;
    default:
      return memberPrimaryLinks;
  }
}

/**
 * Get secondary navigation links for a given role
 */
export function getSecondaryLinksForRole(role: string): MenuSection[] {
  const r = role?.toLowerCase();
  switch (r) {
    case 'admin':
      return adminSecondaryLinks;
    case 'board':
    case 'arb_board':
      return boardSecondaryLinks;
    case 'arb':
      return arbSecondaryLinks;
    default:
      return memberSecondaryLinks;
  }
}

/**
 * Get quick actions for a given role (if available)
 */
export function getQuickActionsForRole(role: string): MenuItem[] {
  const r = role?.toLowerCase();
  switch (r) {
    case 'admin':
      return adminQuickActions;
    case 'board':
    case 'arb_board':
      return boardQuickActions;
    case 'arb':
      return arbQuickActions;
    default:
      return [];
  }
}

/**
 * Get all menu items for a given role (flattened)
 */
export function getAllMenuItemsForRole(role: string): MenuItem[] {
  const r = role?.toLowerCase();
  switch (r) {
    case 'admin':
      return getAllAdminMenuItems();
    case 'board':
    case 'arb_board':
      return getAllBoardMenuItems();
    case 'arb':
      return getAllArbMenuItems();
    default:
      return getAllMemberMenuItems();
  }
}

/**
 * Get role display information
 */
export function getRoleInfo(role: string): { label: string; color: string; landingZone: string } {
  const r = role?.toLowerCase();
  switch (r) {
    case 'admin':
      return { label: 'Administrator', color: 'purple', landingZone: '/portal/admin' };
    case 'board':
      return { label: 'Board Member', color: 'blue', landingZone: '/portal/board' };
    case 'arb':
      return { label: 'ARB Committee', color: 'green', landingZone: '/portal/arb' };
    case 'arb_board':
      return { label: 'Board & ARB', color: 'indigo', landingZone: '/portal/board' };
    default:
      return { label: 'Member', color: 'gray', landingZone: '/portal/dashboard' };
  }
}

// Re-export role-specific configurations
export {
  memberPrimaryLinks,
  memberSecondaryLinks,
  memberHelpLinks,
  adminPrimaryLinks,
  adminSecondaryLinks,
  adminQuickActions,
  boardPrimaryLinks,
  boardSecondaryLinks,
  boardQuickActions,
  arbPrimaryLinks,
  arbSecondaryLinks,
  arbQuickActions,
};
