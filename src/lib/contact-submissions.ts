/**
 * Shared constants and utilities for contact form submissions.
 */

/** SQL expression for filtering contact submissions to the last year (expiry cutoff). */
export const CONTACT_SUBMISSIONS_EXPIRY_SQL = "datetime('now', '-1 year')";

/** SQL WHERE clause fragment for filtering non-expired contact submissions. */
export const CONTACT_SUBMISSIONS_EXPIRY_WHERE = `created_at >= ${CONTACT_SUBMISSIONS_EXPIRY_SQL}`;
