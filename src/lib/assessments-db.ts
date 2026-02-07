/**
 * D1 helpers for Phase 5: Assessments (view-only).
 */

export interface Assessment {
  owner_email: string;
  balance: number;
  next_due: string | null;
  /** Dues paid through this date (inclusive). When today <= paid_through, no overdue/due reminders. */
  paid_through: string | null;
  last_payment: string | null;
  invoice_r2_key: string | null;
  updated: string;
}

export interface AssessmentPayment {
  id: string;
  owner_email: string;
  paid_at: string;
  amount: number;
  balance_after: number;
  created: string;
}

/** Get assessment for one owner (by email). */
export async function getAssessmentByOwner(db: D1Database, ownerEmail: string): Promise<Assessment | null> {
  const email = ownerEmail.trim().toLowerCase();
  const row = await db
    .prepare(
      'SELECT owner_email, balance, next_due, paid_through, last_payment, invoice_r2_key, updated FROM assessments WHERE owner_email = ? LIMIT 1'
    )
    .bind(email)
    .first<Assessment>();
  return row;
}

/** Get payment history for owner, last 12 months, newest first. */
export async function getPaymentHistory(db: D1Database, ownerEmail: string): Promise<AssessmentPayment[]> {
  const email = ownerEmail.trim().toLowerCase();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const { results } = await db
    .prepare(
      'SELECT id, owner_email, paid_at, amount, balance_after, created FROM assessment_payments WHERE owner_email = ? AND paid_at >= ? ORDER BY paid_at DESC LIMIT 100'
    )
    .bind(email, cutoffStr)
    .all<AssessmentPayment>();
  return results ?? [];
}
