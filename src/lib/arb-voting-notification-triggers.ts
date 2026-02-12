/**
 * Notification triggers for ARB multi-stage voting workflow.
 *
 * These functions are called from API endpoints to send emails at the right times.
 * Includes debouncing to prevent spam.
 */
/// <reference types="@cloudflare/workers-types" />

import { sendEmail, type NotificationEnv } from './notifications.js';
import type { ArbRequest } from './arb-db.js';
import {
  getRequestSubmittedEmail,
  getArcReviewStartedEmail,
  getVoteCastEmail,
  getArcDecisionEmail,
  getBoardReviewStartedEmail,
  getBoardDecisionEmail,
  getDeadlineWarningEmail,
  getAutoApprovedEmail,
} from './arb-voting-notifications.js';

// Debouncing: Track last notification sent for each request/type
interface NotificationDebounce {
  request_id: string;
  notification_type: string;
  last_sent_at: string;
}

const VOTE_CAST_DEBOUNCE_MINUTES = 30; // Don't send "vote cast" emails more than once per 30 minutes

/**
 * Get list of users with a specific role (for notification recipients).
 */
async function getUsersByRole(
  db: D1Database,
  role: 'arb' | 'board' | 'arb_board'
): Promise<Array<{ email: string; name: string | null }>> {
  const { results } = await db
    .prepare(
      `SELECT email, name
       FROM users
       WHERE (role = ? OR role = 'arb_board')
         AND status = 'active'`
    )
    .bind(role)
    .all<{ email: string; name: string | null }>();

  return results ?? [];
}

/**
 * Get user info by email.
 */
async function getUserByEmail(
  db: D1Database,
  email: string
): Promise<{ email: string; name: string | null } | null> {
  const user = await db
    .prepare(
      `SELECT email, name
       FROM users
       WHERE email = ?
       LIMIT 1`
    )
    .bind(email.toLowerCase())
    .first<{ email: string; name: string | null }>();

  return user;
}

/**
 * Check if enough time has passed since last notification of this type for this request.
 */
async function shouldSendDebounced(
  db: D1Database,
  requestId: string,
  notificationType: string,
  debounceMinutes: number
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT last_sent_at
       FROM arb_notification_debounce
       WHERE request_id = ? AND notification_type = ?
       LIMIT 1`
    )
    .bind(requestId, notificationType)
    .first<{ last_sent_at: string }>();

  if (!row) {
    return true; // Never sent before
  }

  const lastSent = new Date(row.last_sent_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSent.getTime()) / (1000 * 60);

  return diffMinutes >= debounceMinutes;
}

/**
 * Record that a notification was sent (for debouncing).
 */
async function recordNotificationSent(
  db: D1Database,
  requestId: string,
  notificationType: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO arb_notification_debounce (request_id, notification_type, last_sent_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(request_id, notification_type)
       DO UPDATE SET last_sent_at = datetime('now')`
    )
    .bind(requestId, notificationType)
    .run();
}

/**
 * 1. Request submitted - notify ARC members
 */
export async function notifyRequestSubmitted(
  env: NotificationEnv,
  db: D1Database,
  request: ArbRequest
): Promise<void> {
  const arcMembers = await getUsersByRole(db, 'arb');

  const { subject, html } = getRequestSubmittedEmail(
    request.id,
    request.owner_email,
    request.description
  );

  for (const member of arcMembers) {
    await sendEmail(env, member.email, subject, html, { html: true });
  }
}

/**
 * 2. ARC review started - notify request owner
 */
export async function notifyArcReviewStarted(
  env: NotificationEnv,
  db: D1Database,
  request: ArbRequest
): Promise<void> {
  const owner = await getUserByEmail(db, request.owner_email);
  if (!owner) return;

  const ownerName = owner.name || owner.email;

  const { subject, html } = getArcReviewStartedEmail(request.id, ownerName);

  await sendEmail(env, owner.email, subject, html, { html: true });
}

/**
 * 3. Vote cast - notify other reviewers (debounced)
 */
export async function notifyVoteCast(
  env: NotificationEnv,
  db: D1Database,
  requestId: string,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW',
  votesCast: number,
  totalEligible: number,
  majorityNeeded: number
): Promise<void> {
  // Check debouncing
  const shouldSend = await shouldSendDebounced(
    db,
    requestId,
    `vote_cast_${stage}`,
    VOTE_CAST_DEBOUNCE_MINUTES
  );

  if (!shouldSend) {
    return; // Skip to prevent spam
  }

  const role = stage === 'ARC_REVIEW' ? 'arb' : 'board';
  const reviewers = await getUsersByRole(db, role);

  const { subject, html } = getVoteCastEmail(
    requestId,
    stage,
    votesCast,
    totalEligible,
    majorityNeeded
  );

  for (const reviewer of reviewers) {
    await sendEmail(env, reviewer.email, subject, html, { html: true });
  }

  // Record that we sent this notification
  await recordNotificationSent(db, requestId, `vote_cast_${stage}`);
}

/**
 * 4. ARC decision reached - notify owner (and board if approved)
 */
export async function notifyArcDecision(
  env: NotificationEnv,
  db: D1Database,
  request: ArbRequest,
  decision: 'APPROVED' | 'DENIED' | 'RETURNED',
  approveCount: number,
  denyCount: number,
  returnCount: number,
  comment?: string
): Promise<void> {
  const owner = await getUserByEmail(db, request.owner_email);
  if (!owner) return;

  const ownerName = owner.name || owner.email;

  const { subject, html } = getArcDecisionEmail(
    request.id,
    ownerName,
    decision,
    approveCount,
    denyCount,
    returnCount,
    comment
  );

  // Notify owner
  await sendEmail(env, owner.email, subject, html, { html: true });

  // If approved, notify Board members
  if (decision === 'APPROVED') {
    const boardMembers = await getUsersByRole(db, 'board');
    const { subject: boardSubject, html: boardHtml } = getBoardReviewStartedEmail(
      request.id,
      'Board Member',
      false
    );

    for (const member of boardMembers) {
      await sendEmail(env, member.email, boardSubject, boardHtml, { html: true });
    }
  }
}

/**
 * 5. Board review started - notify owner and board members
 */
export async function notifyBoardReviewStarted(
  env: NotificationEnv,
  db: D1Database,
  request: ArbRequest
): Promise<void> {
  // Notify owner
  const owner = await getUserByEmail(db, request.owner_email);
  if (owner) {
    const ownerName = owner.name || owner.email;
    const { subject, html } = getBoardReviewStartedEmail(request.id, ownerName, true);
    await sendEmail(env, owner.email, subject, html, { html: true });
  }

  // Notify board members
  const boardMembers = await getUsersByRole(db, 'board');
  for (const member of boardMembers) {
    const { subject, html } = getBoardReviewStartedEmail(
      request.id,
      member.name || member.email,
      false
    );
    await sendEmail(env, member.email, subject, html, { html: true });
  }
}

/**
 * 6. Board decision reached - notify owner
 */
export async function notifyBoardDecision(
  env: NotificationEnv,
  db: D1Database,
  request: ArbRequest,
  decision: 'APPROVED' | 'DENIED' | 'RETURNED',
  approveCount: number,
  denyCount: number,
  returnCount: number,
  comment?: string
): Promise<void> {
  const owner = await getUserByEmail(db, request.owner_email);
  if (!owner) return;

  const ownerName = owner.name || owner.email;

  const { subject, html } = getBoardDecisionEmail(
    request.id,
    ownerName,
    decision,
    approveCount,
    denyCount,
    returnCount,
    comment
  );

  await sendEmail(env, owner.email, subject, html, { html: true });
}

/**
 * 7. Deadline warning (7 or 3 days) - notify reviewers
 */
export async function notifyDeadlineWarning(
  env: NotificationEnv,
  db: D1Database,
  requestId: string,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW',
  daysRemaining: number,
  deadlineDate: string
): Promise<void> {
  const role = stage === 'ARC_REVIEW' ? 'arb' : 'board';
  const reviewers = await getUsersByRole(db, role);

  const { subject, html } = getDeadlineWarningEmail(
    requestId,
    stage,
    daysRemaining,
    deadlineDate
  );

  for (const reviewer of reviewers) {
    await sendEmail(env, reviewer.email, subject, html, { html: true });
  }
}

/**
 * 8. Auto-approved due to deadline - notify owner (and board if ARC stage)
 */
export async function notifyAutoApproved(
  env: NotificationEnv,
  db: D1Database,
  request: ArbRequest,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW'
): Promise<void> {
  const owner = await getUserByEmail(db, request.owner_email);
  if (!owner) return;

  const ownerName = owner.name || owner.email;

  const { subject, html } = getAutoApprovedEmail(request.id, ownerName, stage);

  await sendEmail(env, owner.email, subject, html, { html: true });

  // If ARC stage was auto-approved, notify Board members
  if (stage === 'ARC_REVIEW') {
    const boardMembers = await getUsersByRole(db, 'board');
    const { subject: boardSubject, html: boardHtml } = getBoardReviewStartedEmail(
      request.id,
      'Board Member',
      false
    );

    for (const member of boardMembers) {
      await sendEmail(env, member.email, boardSubject, boardHtml, { html: true });
    }
  }
}

/**
 * Helper: Send deadline warnings for requests approaching deadline.
 * Call this from a scheduled job or periodic check.
 */
export async function sendDeadlineWarnings(
  env: NotificationEnv,
  db: D1Database
): Promise<{ sent_7_day: number; sent_3_day: number }> {
  // Check 7-day warnings
  const { results: requests7Day } = await db
    .prepare(
      `SELECT id, current_stage, deadline_date
       FROM arb_requests
       WHERE workflow_version = 2
         AND current_stage IN ('ARC_REVIEW', 'BOARD_REVIEW')
         AND deadline_date IS NOT NULL
         AND datetime(deadline_date, '-7 days') <= datetime('now')
         AND datetime(deadline_date, '-6 days') > datetime('now')
         AND auto_approved_reason IS NULL
         AND (deleted_at IS NULL OR deleted_at = '')`
    )
    .all<{ id: string; current_stage: 'ARC_REVIEW' | 'BOARD_REVIEW'; deadline_date: string }>();

  let sent7Day = 0;
  for (const req of requests7Day ?? []) {
    const shouldSend = await shouldSendDebounced(
      db,
      req.id,
      'deadline_warning_7day',
      24 * 60 // Once per day
    );
    if (shouldSend) {
      await notifyDeadlineWarning(env, db, req.id, req.current_stage, 7, req.deadline_date);
      await recordNotificationSent(db, req.id, 'deadline_warning_7day');
      sent7Day++;
    }
  }

  // Check 3-day warnings
  const { results: requests3Day } = await db
    .prepare(
      `SELECT id, current_stage, deadline_date
       FROM arb_requests
       WHERE workflow_version = 2
         AND current_stage IN ('ARC_REVIEW', 'BOARD_REVIEW')
         AND deadline_date IS NOT NULL
         AND datetime(deadline_date, '-3 days') <= datetime('now')
         AND datetime(deadline_date, '-2 days') > datetime('now')
         AND auto_approved_reason IS NULL
         AND (deleted_at IS NULL OR deleted_at = '')`
    )
    .all<{ id: string; current_stage: 'ARC_REVIEW' | 'BOARD_REVIEW'; deadline_date: string }>();

  let sent3Day = 0;
  for (const req of requests3Day ?? []) {
    const shouldSend = await shouldSendDebounced(
      db,
      req.id,
      'deadline_warning_3day',
      24 * 60 // Once per day
    );
    if (shouldSend) {
      await notifyDeadlineWarning(env, db, req.id, req.current_stage, 3, req.deadline_date);
      await recordNotificationSent(db, req.id, 'deadline_warning_3day');
      sent3Day++;
    }
  }

  return { sent_7_day: sent7Day, sent_3_day: sent3Day };
}
