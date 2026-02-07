/**
 * D1 helpers for Phase 5: Assessments (view + board record payments, special assessments).
 */

const ID_LEN = 21;
function generateId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let id = '';
  const bytes = new Uint8Array(ID_LEN);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < ID_LEN; i++) id += chars[bytes[i]! % chars.length];
  } else {
    for (let i = 0; i < ID_LEN; i++) id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

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
  /** Email of the board/admin user who recorded this payment (audit). */
  recorded_by: string | null;
}

export interface SpecialAssessment {
  id: string;
  owner_email: string;
  description: string;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  created_by: string | null;
  created: string | null;
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

/** All assessment rows (for board spreadsheet). */
export async function listAllAssessments(db: D1Database): Promise<Assessment[]> {
  const { results } = await db
    .prepare(
      'SELECT owner_email, balance, next_due, paid_through, last_payment, invoice_r2_key, updated FROM assessments ORDER BY owner_email'
    )
    .all<Assessment>();
  return results ?? [];
}

/** All special assessments (for board spreadsheet). */
export async function listAllSpecialAssessments(db: D1Database): Promise<SpecialAssessment[]> {
  const { results } = await db
    .prepare(
      'SELECT id, owner_email, description, amount, due_date, paid_at, created_by, created FROM special_assessments ORDER BY owner_email, created DESC'
    )
    .all<SpecialAssessment>();
  return results ?? [];
}

/** List recent assessment payments that have recorded_by (for board audit log). Newest first. */
export async function listAssessmentPaymentsForAudit(db: D1Database, limit: number): Promise<AssessmentPayment[]> {
  const { results } = await db
    .prepare(
      `SELECT id, owner_email, paid_at, amount, balance_after, created, recorded_by
       FROM assessment_payments WHERE recorded_by IS NOT NULL AND recorded_by != ''
       ORDER BY created DESC LIMIT ?`
    )
    .bind(Math.max(1, Math.min(limit, 500)))
    .all<AssessmentPayment>();
  return results ?? [];
}

/** Get payment history for owner, last 12 months, newest first. */
export async function getPaymentHistory(db: D1Database, ownerEmail: string): Promise<AssessmentPayment[]> {
  const email = ownerEmail.trim().toLowerCase();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const { results } = await db
    .prepare(
      'SELECT id, owner_email, paid_at, amount, balance_after, created, recorded_by FROM assessment_payments WHERE owner_email = ? AND paid_at >= ? ORDER BY paid_at DESC LIMIT 100'
    )
    .bind(email, cutoffStr)
    .all<AssessmentPayment>();
  return results ?? [];
}

/** Ensure an assessment row exists for owner; create with defaults if not. Returns the assessment. */
export async function upsertAssessment(
  db: D1Database,
  ownerEmail: string,
  defaults?: { balance?: number; next_due?: string | null; paid_through?: string | null }
): Promise<Assessment> {
  const email = ownerEmail.trim().toLowerCase();
  const existing = await getAssessmentByOwner(db, email);
  if (existing) return existing;
  const balance = defaults?.balance ?? 0;
  const next_due = defaults?.next_due ?? null;
  const paid_through = defaults?.paid_through ?? null;
  await db
    .prepare(
      `INSERT INTO assessments (owner_email, balance, next_due, paid_through, last_payment, invoice_r2_key, updated)
       VALUES (?, ?, ?, ?, NULL, NULL, datetime('now'))`
    )
    .bind(email, balance, next_due, paid_through)
    .run();
  const row = await getAssessmentByOwner(db, email);
  if (!row) throw new Error('Failed to create assessment');
  return row;
}

/**
 * Record a payment for an owner. Updates assessments (balance, paid_through, last_payment) and inserts assessment_payments.
 * If fullYear is true, paid_through is set to Dec 31 of the given year (default current year), and one payment row is recorded.
 * recordedBy is the email of the user who recorded the payment (for audit).
 */
export async function recordPayment(
  db: D1Database,
  ownerEmail: string,
  params: {
    amount: number;
    paid_at: string; // YYYY-MM-DD
    balance_after: number;
    paid_through?: string | null; // optional; if fullYear, set to YYYY-12-31
    fullYear?: boolean; // if true, set paid_through to end of year of paid_at
    recorded_by?: string | null; // email of user who recorded (audit)
  }
): Promise<{ paymentId: string }> {
  const email = ownerEmail.trim().toLowerCase();
  await upsertAssessment(db, email);
  let paidThrough = params.paid_through ?? null;
  if (params.fullYear && params.paid_at) {
    const year = new Date(params.paid_at + 'T12:00:00').getFullYear();
    paidThrough = `${year}-12-31`;
  }
  const paymentId = generateId();
  const recordedBy = params.recorded_by?.trim() || null;
  await db
    .prepare(
      `INSERT INTO assessment_payments (id, owner_email, paid_at, amount, balance_after, created, recorded_by)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`
    )
    .bind(paymentId, email, params.paid_at, params.amount, params.balance_after, recordedBy)
    .run();
  await db
    .prepare(
      `UPDATE assessments SET balance = ?, paid_through = ?, last_payment = ?, updated = datetime('now') WHERE owner_email = ?`
    )
    .bind(params.balance_after, paidThrough, params.paid_at, email)
    .run();
  return { paymentId };
}

/** List special assessments for an owner (newest first). */
export async function listSpecialAssessmentsByOwner(
  db: D1Database,
  ownerEmail: string
): Promise<SpecialAssessment[]> {
  const email = ownerEmail.trim().toLowerCase();
  const { results } = await db
    .prepare(
      `SELECT id, owner_email, description, amount, due_date, paid_at, created_by, created
       FROM special_assessments WHERE owner_email = ? ORDER BY created DESC LIMIT 50`
    )
    .bind(email)
    .all<SpecialAssessment>();
  return results ?? [];
}

/** Add a special assessment for an owner. */
export async function addSpecialAssessment(
  db: D1Database,
  params: {
    owner_email: string;
    description: string;
    amount: number;
    due_date?: string | null;
    created_by?: string | null;
  }
): Promise<{ id: string }> {
  const id = generateId();
  const email = params.owner_email.trim().toLowerCase();
  const due_date = params.due_date?.trim() || null;
  const created_by = params.created_by?.trim() || null;
  await db
    .prepare(
      `INSERT INTO special_assessments (id, owner_email, description, amount, due_date, paid_at, created_by, created)
       VALUES (?, ?, ?, ?, ?, NULL, ?, datetime('now'))`
    )
    .bind(id, email, params.description.trim(), params.amount, due_date, created_by)
    .run();
  return { id };
}

/** Mark a special assessment as paid. */
export async function markSpecialAssessmentPaid(
  db: D1Database,
  id: string,
  ownerEmail: string,
  paid_at: string
): Promise<boolean> {
  const email = ownerEmail.trim().toLowerCase();
  const result = await db
    .prepare(`UPDATE special_assessments SET paid_at = ? WHERE id = ? AND owner_email = ?`)
    .bind(paid_at, id, email)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
