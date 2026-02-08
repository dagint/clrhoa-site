/**
 * D1 helpers for Phase 5: Assessments (view + board record payments, special assessments).
 */

const ID_LEN = 21;

/** Quarter end dates: Q1=Mar 31, Q2=Jun 30, Q3=Sep 30, Q4=Dec 31. Used for "paid through" and current-cycle filter. */
export const QUARTERS = [
  { q: 'Q1', endMonth: 2, endDay: 31 },
  { q: 'Q2', endMonth: 5, endDay: 30 },
  { q: 'Q3', endMonth: 8, endDay: 30 },
  { q: 'Q4', endMonth: 11, endDay: 31 },
];

function toLocalDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 0–3 for Jan–Mar=0, Apr–Jun=1, Jul–Sep=2, Oct–Dec=3. */
export function getQuarterIndex(date: Date): number {
  const m = date.getMonth();
  if (m <= 2) return 0;
  if (m <= 5) return 1;
  if (m <= 8) return 2;
  return 3;
}

/** End date of current quarter (YYYY-MM-DD). */
export function getCurrentQuarterEnd(): string {
  const now = new Date();
  const qi = getQuarterIndex(now);
  const y = now.getFullYear();
  const qu = QUARTERS[qi]!;
  return toLocalDateString(y, qu.endMonth, qu.endDay);
}

/** Quarter end date N quarters from the quarter containing fromDate (YYYY-MM-DD). N 1–4. */
export function getQuarterEndAfterNQuarters(fromDate: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || n < 1 || n > 4) return fromDate;
  const d = new Date(fromDate + 'T12:00:00');
  let year = d.getFullYear();
  let qi = getQuarterIndex(d);
  for (let i = 1; i < n; i++) {
    qi += 1;
    if (qi > 3) {
      qi = 0;
      year += 1;
    }
  }
  const qu = QUARTERS[qi]!;
  return toLocalDateString(year, qu.endMonth, qu.endDay);
}

/** True if household has not paid through the given quarter end (missing for that cycle). */
export function isMissingForQuarter(paidThrough: string | null, quarterEnd: string): boolean {
  if (!paidThrough || !paidThrough.trim()) return true;
  return paidThrough.trim() < quarterEnd;
}
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

/** Allowed values for payment_method when recording a payment. */
export const PAYMENT_METHODS = ['electronic_transfer', 'check', 'cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface AssessmentPayment {
  id: string;
  owner_email: string;
  paid_at: string;
  amount: number;
  balance_after: number;
  created: string;
  /** Email of the board/admin user who recorded this payment (audit). */
  recorded_by: string | null;
  /** Dues paid through this date (inclusive) after this payment. Used for receipts (periods covered). */
  paid_through_after: string | null;
  /** How payment was received: electronic_transfer, check, cash. */
  payment_method: string | null;
  /** Check number when payment_method is check. */
  check_number: string | null;
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

const PAYMENT_SELECT =
  'id, owner_email, paid_at, amount, balance_after, created, recorded_by, paid_through_after, payment_method, check_number';

/** List recent assessment payments that have recorded_by (for board audit log). Newest first. */
export async function listAssessmentPaymentsForAudit(db: D1Database, limit: number, offset = 0): Promise<AssessmentPayment[]> {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const safeOffset = Math.max(0, offset);
  const { results } = await db
    .prepare(
      `SELECT ${PAYMENT_SELECT} FROM assessment_payments WHERE recorded_by IS NOT NULL AND recorded_by != ''
       ORDER BY created DESC LIMIT ? OFFSET ?`
    )
    .bind(safeLimit, safeOffset)
    .all<AssessmentPayment>();
  return (results ?? []).map((r) => ({ ...r, payment_method: r.payment_method ?? null, check_number: r.check_number ?? null }));
}

/** Get payment history for owner, last 12 months, newest first. */
export async function getPaymentHistory(db: D1Database, ownerEmail: string): Promise<AssessmentPayment[]> {
  const email = ownerEmail.trim().toLowerCase();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const { results } = await db
    .prepare(
      `SELECT ${PAYMENT_SELECT} FROM assessment_payments WHERE owner_email = ? AND paid_at >= ? ORDER BY paid_at DESC LIMIT 100`
    )
    .bind(email, cutoffStr)
    .all<AssessmentPayment>();
  return (results ?? []).map((r) => ({
    ...r,
    paid_through_after: r.paid_through_after ?? null,
    payment_method: r.payment_method ?? null,
    check_number: r.check_number ?? null,
  }));
}

/** Get a single payment by id; only returns if owner_email matches (for receipt). */
export async function getPaymentById(
  db: D1Database,
  paymentId: string,
  ownerEmail: string
): Promise<AssessmentPayment | null> {
  const email = ownerEmail.trim().toLowerCase();
  const row = await db
    .prepare(
      `SELECT ${PAYMENT_SELECT} FROM assessment_payments WHERE id = ? AND owner_email = ? LIMIT 1`
    )
    .bind(paymentId, email)
    .first<AssessmentPayment & { paid_through_after?: string | null }>();
  if (!row) return null;
  return {
    ...row,
    paid_through_after: row.paid_through_after ?? null,
    payment_method: (row as AssessmentPayment).payment_method ?? null,
    check_number: (row as AssessmentPayment).check_number ?? null,
  };
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
 * - quarters_to_apply (1–4): set paid_through to end of that many quarters from the quarter of paid_at (e.g. 4 = current + 3 future).
 * - If fullYear is true and no quarters_to_apply, paid_through = Dec 31 of year of paid_at.
 * - recorded_by: email of user who recorded (audit).
 */
export async function recordPayment(
  db: D1Database,
  ownerEmail: string,
  params: {
    amount: number;
    paid_at: string; // YYYY-MM-DD
    balance_after: number;
    paid_through?: string | null;
    fullYear?: boolean;
    /** 1–4: apply payment to this many quarters (current + future); sets paid_through to that quarter end. */
    quarters_to_apply?: number;
    recorded_by?: string | null;
    /** How received: electronic_transfer, check, cash. */
    payment_method?: string | null;
    /** Check number when payment_method is check. */
    check_number?: string | null;
  }
): Promise<{ paymentId: string }> {
  const email = ownerEmail.trim().toLowerCase();
  await upsertAssessment(db, email);
  let paidThrough = params.paid_through ?? null;
  if (params.quarters_to_apply != null && params.quarters_to_apply >= 1 && params.quarters_to_apply <= 4 && params.paid_at) {
    paidThrough = getQuarterEndAfterNQuarters(params.paid_at, params.quarters_to_apply);
  } else if (params.fullYear && params.paid_at) {
    const year = new Date(params.paid_at + 'T12:00:00').getFullYear();
    paidThrough = `${year}-12-31`;
  }
  const paymentId = generateId();
  const recordedBy = params.recorded_by?.trim() || null;
  const method = params.payment_method?.trim() && PAYMENT_METHODS.includes(params.payment_method.trim() as PaymentMethod) ? params.payment_method.trim() : null;
  const checkNum = params.check_number?.trim() || null;
  await db
    .prepare(
      `INSERT INTO assessment_payments (id, owner_email, paid_at, amount, balance_after, created, recorded_by, paid_through_after, payment_method, check_number)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?)`
    )
    .bind(paymentId, email, params.paid_at, params.amount, params.balance_after, recordedBy, paidThrough, method, checkNum)
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
