/**
 * Audit log for admin assume-role: when admins assume or clear Board/ARB role, and actions taken while assumed.
 */

export type AdminAssumedRoleAction = 'assume' | 'clear' | 'action';

export interface AdminAssumedRoleAuditRow {
  id: number;
  admin_email: string;
  actor_role: string | null;
  action: string;
  role_assumed: string | null;
  action_detail: string | null;
  ip_address: string | null;
  created: string;
}

export async function insertAdminAssumedRoleAudit(
  db: D1Database,
  params: {
    admin_email: string;
    action: AdminAssumedRoleAction;
    actor_role?: 'admin' | 'arb_board' | null;
    role_assumed?: 'board' | 'arb' | null;
    action_detail?: string | null;
    ip_address?: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO admin_assumed_role_audit (admin_email, actor_role, action, role_assumed, action_detail, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      params.admin_email.trim().toLowerCase(),
      params.actor_role ?? null,
      params.action,
      params.role_assumed ?? null,
      params.action_detail ?? null,
      params.ip_address ?? null
    )
    .run();
}

/** List recent assume-role audit entries for Board audit page. Newest first. */
export async function listAdminAssumedRoleAudit(
  db: D1Database,
  limit = 200,
  offset = 0
): Promise<AdminAssumedRoleAuditRow[]> {
  const safeOffset = Math.max(0, offset);
  const { results } = await db
    .prepare(
      `SELECT id, admin_email, actor_role, action, role_assumed, action_detail, ip_address, created
       FROM admin_assumed_role_audit
       ORDER BY created DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, safeOffset)
    .all();
  return (results ?? []) as unknown as AdminAssumedRoleAuditRow[];
}
