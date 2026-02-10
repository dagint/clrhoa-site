/**
 * Route-level guard helpers for protected routes.
 *
 * These helpers enforce permissions at the page level, complementing middleware checks.
 * Use them to add explicit role requirements and redirect logic to protected routes.
 *
 * Pattern:
 * ```typescript
 * const guard = await withRoleProtection(Astro, 'admin');
 * if ('redirect' in guard) return Astro.redirect(guard.redirect);
 * const { env, session, effectiveRole } = guard;
 * ```
 */

import type { RoleContextAstro, GetRoleContextResult } from './board-context';
import { getAdminContext, getBoardContext, getArbContext } from './board-context';

export type RequiredRole = 'admin' | 'board' | 'arb' | 'arb_board' | 'member';

/**
 * Route-level guard for ADMIN-only routes.
 *
 * Required permissions: effectiveRole === 'admin'
 *
 * Returns context if authorized, or redirect URL if not.
 * Pages should check for redirect and call Astro.redirect() immediately.
 */
export async function withAdminProtection(astro: RoleContextAstro): Promise<GetRoleContextResult> {
  return await getAdminContext(astro);
}

/**
 * Route-level guard for BOARD-only routes.
 *
 * Required permissions: effectiveRole === 'board' or 'arb_board'
 *
 * Returns context if authorized, or redirect URL if not.
 * Pages should check for redirect and call Astro.redirect() immediately.
 */
export async function withBoardProtection(astro: RoleContextAstro): Promise<GetRoleContextResult> {
  return await getBoardContext(astro);
}

/**
 * Route-level guard for ARB-only routes.
 *
 * Required permissions: effectiveRole === 'arb' or 'arb_board'
 *
 * Returns context if authorized, or redirect URL if not.
 * Pages should check for redirect and call Astro.redirect() immediately.
 */
export async function withArbProtection(astro: RoleContextAstro): Promise<GetRoleContextResult> {
  return await getArbContext(astro);
}

/**
 * Generic route-level guard with configurable role requirements.
 *
 * @param astro - Astro context
 * @param requiredRole - Required role(s). 'arb_board' allows both 'arb' and 'board'.
 * @returns Context if authorized, or redirect URL if not
 *
 * Usage:
 * ```typescript
 * const guard = await withRoleProtection(Astro, 'admin');
 * if ('redirect' in guard) return Astro.redirect(guard.redirect);
 * ```
 */
export async function withRoleProtection(
  astro: RoleContextAstro,
  requiredRole: RequiredRole
): Promise<GetRoleContextResult> {
  switch (requiredRole) {
    case 'admin':
      return await withAdminProtection(astro);
    case 'board':
    case 'arb_board':
      return await withBoardProtection(astro);
    case 'arb':
      return await withArbProtection(astro);
    case 'member':
      // Member routes are handled by getPortalContext, not role guards
      throw new Error('Member routes should use getPortalContext, not withRoleProtection');
    default:
      throw new Error(`Unknown required role: ${requiredRole}`);
  }
}
