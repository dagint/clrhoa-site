/**
 * D1 database helpers for ARB multi-stage voting workflow (Phase 2).
 *
 * This module provides database operations for the new voting system:
 * - Vote casting and retrieval
 * - Eligible voter calculation with recusal logic
 * - Vote resolution and status transitions
 * - Deadline tracking and auto-approval
 */
/// <reference types="@cloudflare/workers-types" />

import { generateId } from '../utils/id-generator.js';
import { getArbRequest, type ArbRequest } from './arb-db.js';

// ============================================================================
// Types
// ============================================================================

export interface ArcRequestVote {
  id: string;
  request_id: string;
  voter_email: string;
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW';
  vote: 'APPROVE' | 'DENY' | 'RETURN' | 'ABSTAIN';
  comment: string | null;
  voted_at: string;
  updated_at: string | null;
  cycle: number;
}

export interface VoteResolutionResult {
  outcome: 'PENDING' | 'APPROVED' | 'DENIED' | 'RETURNED' | 'DEADLOCKED';
  approveCount: number;
  denyCount: number;
  returnCount: number;
  abstainCount: number;
  totalEligible: number;
  activeVoters: number;
  majorityNeeded: number;
  allVotesCast: boolean;
}

export interface EligibleVoter {
  email: string;
  name: string | null;
  role: string;
  recused: boolean;
  recusal_reason: string | null;
}

// ============================================================================
// Vote Operations
// ============================================================================

/**
 * Cast or update a vote for a request.
 * If vote already exists for this voter/stage/cycle, updates it.
 * Otherwise creates a new vote record.
 */
export async function castVote(
  db: D1Database,
  requestId: string,
  voterEmail: string,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW',
  vote: 'APPROVE' | 'DENY' | 'RETURN' | 'ABSTAIN',
  comment: string | null,
  cycle: number
): Promise<ArcRequestVote> {
  const email = voterEmail.trim().toLowerCase();
  const commentText = comment?.trim() || null;

  // Check if vote already exists
  const existing = await db
    .prepare(
      `SELECT id, request_id, voter_email, stage, vote, comment, voted_at, updated_at, cycle
       FROM arc_request_votes
       WHERE request_id = ? AND voter_email = ? AND stage = ? AND cycle = ?
       LIMIT 1`
    )
    .bind(requestId, email, stage, cycle)
    .first<ArcRequestVote>();

  if (existing) {
    // Update existing vote
    await db
      .prepare(
        `UPDATE arc_request_votes
         SET vote = ?, comment = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(vote, commentText, existing.id)
      .run();

    return {
      ...existing,
      vote,
      comment: commentText,
      updated_at: new Date().toISOString(),
    };
  } else {
    // Create new vote
    const id = generateId();
    await db
      .prepare(
        `INSERT INTO arc_request_votes (id, request_id, voter_email, stage, vote, comment, cycle)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, requestId, email, stage, vote, commentText, cycle)
      .run();

    return {
      id,
      request_id: requestId,
      voter_email: email,
      stage,
      vote,
      comment: commentText,
      voted_at: new Date().toISOString(),
      updated_at: null,
      cycle,
    };
  }
}

/**
 * Get all votes for a specific request, stage, and cycle.
 */
export async function getVotesForRequest(
  db: D1Database,
  requestId: string,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW',
  cycle: number
): Promise<ArcRequestVote[]> {
  const { results } = await db
    .prepare(
      `SELECT id, request_id, voter_email, stage, vote, comment, voted_at, updated_at, cycle
       FROM arc_request_votes
       WHERE request_id = ? AND stage = ? AND cycle = ?
       ORDER BY voted_at ASC`
    )
    .bind(requestId, stage, cycle)
    .all<ArcRequestVote>();

  return results ?? [];
}

/**
 * Get a specific vote by voter email, request, stage, and cycle.
 */
export async function getVoteByVoter(
  db: D1Database,
  requestId: string,
  voterEmail: string,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW',
  cycle: number
): Promise<ArcRequestVote | null> {
  const email = voterEmail.trim().toLowerCase();
  const vote = await db
    .prepare(
      `SELECT id, request_id, voter_email, stage, vote, comment, voted_at, updated_at, cycle
       FROM arc_request_votes
       WHERE request_id = ? AND voter_email = ? AND stage = ? AND cycle = ?
       LIMIT 1`
    )
    .bind(requestId, email, stage, cycle)
    .first<ArcRequestVote>();

  return vote;
}

// ============================================================================
// Eligible Voters (with Recusal Logic)
// ============================================================================

/**
 * Get list of eligible voters for a request at the current stage.
 *
 * Recusal rules:
 * 1. Request owner cannot vote on their own request
 * 2. For BOARD_REVIEW: Dual-role members who voted in ARC_REVIEW are recused
 * 3. Abstentions do NOT trigger recusal from Board stage
 */
export async function getEligibleVoters(
  db: D1Database,
  kv: KVNamespace,
  requestId: string,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW',
  cycle: number
): Promise<EligibleVoter[]> {
  const request = await getArbRequest(db, requestId);
  if (!request) {
    throw new Error('Request not found');
  }

  const ownerEmail = request.owner_email.toLowerCase();

  // Get all users with the appropriate role(s)
  let roleFilter: string[];
  if (stage === 'ARC_REVIEW') {
    // ARC review: users with 'arb' or 'arb_board' role
    roleFilter = ['arb', 'arb_board'];
  } else {
    // Board review: users with 'board' or 'arb_board' role
    roleFilter = ['board', 'arb_board'];
  }

  // Get all users from KV (NOTE: This is a simplified approach; in production,
  // you might want to query a users table in D1 instead)
  const allUsers: EligibleVoter[] = [];

  // Query users table for eligible roles
  const { results } = await db
    .prepare(
      `SELECT email, name, role
       FROM users
       WHERE role IN ('arb', 'board', 'arb_board')
       AND status = 'active'`
    )
    .all<{ email: string; name: string | null; role: string }>();

  for (const user of results ?? []) {
    const userEmail = user.email.toLowerCase();
    const userRole = user.role.toLowerCase();

    // Skip if not in the appropriate role for this stage
    if (!roleFilter.includes(userRole)) {
      continue;
    }

    // Check recusal reasons
    let recused = false;
    let recusal_reason: string | null = null;

    // Rule 1: Request owner cannot vote on their own request
    if (userEmail === ownerEmail) {
      recused = true;
      recusal_reason = 'Request owner cannot vote on own request';
    }

    // Rule 2: For Board stage, check if they voted in ARC stage (dual-role recusal)
    if (!recused && stage === 'BOARD_REVIEW') {
      const arcVote = await getVoteByVoter(db, requestId, userEmail, 'ARC_REVIEW', cycle);
      if (arcVote && arcVote.vote !== 'ABSTAIN') {
        recused = true;
        recusal_reason = 'Voted in ARC review (dual-role recusal)';
      }
    }

    allUsers.push({
      email: userEmail,
      name: user.name,
      role: userRole,
      recused,
      recusal_reason,
    });
  }

  return allUsers;
}

/**
 * Get count of eligible voters (excluding recused members).
 */
export async function getEligibleVoterCount(
  db: D1Database,
  kv: KVNamespace,
  requestId: string,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW',
  cycle: number
): Promise<number> {
  const voters = await getEligibleVoters(db, kv, requestId, stage, cycle);
  return voters.filter(v => !v.recused).length;
}

/**
 * Check if a user is eligible to vote (not recused).
 */
export async function isEligibleToVote(
  db: D1Database,
  kv: KVNamespace,
  requestId: string,
  voterEmail: string,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW',
  cycle: number
): Promise<{ eligible: boolean; reason?: string }> {
  const voters = await getEligibleVoters(db, kv, requestId, stage, cycle);
  const voter = voters.find(v => v.email === voterEmail.toLowerCase());

  if (!voter) {
    return { eligible: false, reason: 'User does not have required role for this stage' };
  }

  if (voter.recused) {
    return { eligible: false, reason: voter.recusal_reason ?? 'Recused' };
  }

  return { eligible: true };
}

// ============================================================================
// Vote Resolution
// ============================================================================

/**
 * Calculate vote resolution outcome for a request at a specific stage.
 * This is the core voting logic that determines if approval/denial/return majority is reached.
 */
export async function resolveVotes(
  db: D1Database,
  kv: KVNamespace,
  requestId: string,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW',
  cycle: number
): Promise<VoteResolutionResult> {
  const votes = await getVotesForRequest(db, requestId, stage, cycle);
  const totalEligible = await getEligibleVoterCount(db, kv, requestId, stage, cycle);

  const approveCount = votes.filter(v => v.vote === 'APPROVE').length;
  const denyCount = votes.filter(v => v.vote === 'DENY').length;
  const returnCount = votes.filter(v => v.vote === 'RETURN').length;
  const abstainCount = votes.filter(v => v.vote === 'ABSTAIN').length;

  // Active voters = total eligible - abstentions
  const activeVoters = totalEligible - abstainCount;

  // Majority = floor(activeVoters / 2) + 1
  const majorityNeeded = Math.floor(activeVoters / 2) + 1;

  // Check if all votes are cast
  const allVotesCast = votes.length >= totalEligible;

  // Determine outcome
  let outcome: VoteResolutionResult['outcome'] = 'PENDING';

  // Guard: if all voters abstained, deadlock
  if (activeVoters === 0) {
    outcome = 'DEADLOCKED';
  } else if (approveCount >= majorityNeeded) {
    outcome = 'APPROVED';
  } else if (denyCount >= majorityNeeded) {
    outcome = 'DENIED';
  } else if (returnCount >= majorityNeeded) {
    outcome = 'RETURNED';
  }

  return {
    outcome,
    approveCount,
    denyCount,
    returnCount,
    abstainCount,
    totalEligible,
    activeVoters,
    majorityNeeded,
    allVotesCast,
  };
}

// ============================================================================
// Status Transitions
// ============================================================================

/**
 * Transition a request to a new status with audit logging.
 */
export async function transitionStatus(
  db: D1Database,
  requestId: string,
  newStatus: string,
  newStage: string | null,
  changedBy: string,
  reason: string | null,
  ipAddress: string | null,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const request = await getArbRequest(db, requestId);
  if (!request) {
    return false;
  }

  const oldStatus = request.status;
  const oldStage = request.current_stage;
  const cycle = request.current_cycle || 1;

  // Update request status
  const updates: string[] = ['status = ?', 'updated_at = datetime(\'now\')'];
  const bindings: unknown[] = [newStatus];

  if (newStage !== null) {
    updates.push('current_stage = ?');
    bindings.push(newStage);
  }

  // Set resolved_at for terminal statuses
  const terminalStatuses = ['BOARD_APPROVED', 'BOARD_DENIED', 'ARC_DENIED'];
  if (terminalStatuses.includes(newStage || '')) {
    updates.push('resolved_at = datetime(\'now\')');
  }

  bindings.push(requestId);

  const result = await db
    .prepare(
      `UPDATE arb_requests
       SET ${updates.join(', ')}
       WHERE id = ?`
    )
    .bind(...bindings)
    .run();

  const updated = (result.meta.changes ?? 0) > 0;

  // Log to audit table
  if (updated) {
    try {
      const metadataJson = metadata ? JSON.stringify(metadata) : null;
      await db
        .prepare(
          `INSERT INTO arb_audit_log (request_id, action, old_status, new_status, changed_by_email, notes, ip_address, cycle, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          requestId,
          'status_transition',
          oldStatus,
          newStatus,
          changedBy,
          reason,
          ipAddress,
          cycle,
          metadataJson
        )
        .run();
    } catch (e) {
      console.error('[arb-voting-db] Failed to write audit log:', e);
    }
  }

  return updated;
}

// ============================================================================
// Deadline Management (No Cron Jobs)
// ============================================================================

/**
 * Check for requests that have exceeded the 30-day deadline and auto-approve them.
 * This function is called on page loads and API calls (lazy evaluation pattern).
 *
 * Returns array of request IDs that were auto-approved.
 */
export async function checkAndApplyDeadlines(db: D1Database): Promise<string[]> {
  // Find requests in ARC_REVIEW or BOARD_REVIEW that have exceeded 30-day deadline
  const { results } = await db
    .prepare(
      `SELECT id, current_stage, owner_email, workflow_version, submitted_at
       FROM arb_requests
       WHERE workflow_version = 2
         AND current_stage IN ('ARC_REVIEW', 'BOARD_REVIEW')
         AND submitted_at IS NOT NULL
         AND deadline_date IS NOT NULL
         AND datetime(deadline_date) <= datetime('now')
         AND auto_approved_reason IS NULL
         AND (deleted_at IS NULL OR deleted_at = '')`
    )
    .all<{ id: string; current_stage: string; owner_email: string; workflow_version: number; submitted_at: string }>();

  const autoApprovedIds: string[] = [];

  for (const req of results ?? []) {
    const nextStatus = req.current_stage === 'ARC_REVIEW' ? 'ARC_APPROVED' : 'BOARD_APPROVED';
    const nextStage = nextStatus;

    // Set auto-approval reason
    await db
      .prepare(
        `UPDATE arb_requests
         SET auto_approved_reason = 'deadline_expired'
         WHERE id = ?`
      )
      .bind(req.id)
      .run();

    // Transition status
    const updated = await transitionStatus(
      db,
      req.id,
      nextStatus,
      nextStage,
      'system',
      'Auto-approved: 30-day deadline expired per FL Statute 720.3035',
      null,
      { auto_approval: true, deadline_expired: true }
    );

    if (updated) {
      autoApprovedIds.push(req.id);

      // If ARC was auto-approved, automatically advance to BOARD_REVIEW
      if (nextStatus === 'ARC_APPROVED') {
        await transitionStatus(
          db,
          req.id,
          'BOARD_REVIEW',
          'BOARD_REVIEW',
          'system',
          'Automatically advanced to Board review after ARC approval',
          null
        );
      }
    }
  }

  return autoApprovedIds;
}

/**
 * Get requests that are nearing their deadline (for warning notifications).
 * @param daysOut - How many days before deadline to warn (e.g., 7 or 3)
 */
export async function getRequestsNearingDeadline(
  db: D1Database,
  daysOut: number
): Promise<ArbRequest[]> {
  const { results } = await db
    .prepare(
      `SELECT id, owner_email, applicant_name, phone, property_address, application_type,
              description, status, esign_timestamp, arb_esign, created, updated_at,
              workflow_version, current_stage, current_cycle, submitted_at, resolved_at,
              auto_approved_reason, deadline_date
       FROM arb_requests
       WHERE workflow_version = 2
         AND current_stage IN ('ARC_REVIEW', 'BOARD_REVIEW')
         AND submitted_at IS NOT NULL
         AND deadline_date IS NOT NULL
         AND datetime(deadline_date, '-${daysOut} days') <= datetime('now')
         AND datetime(deadline_date) > datetime('now')
         AND auto_approved_reason IS NULL
         AND (deleted_at IS NULL OR deleted_at = '')`
    )
    .all<ArbRequest>();

  return results ?? [];
}

/**
 * Set deadline_date when a request is submitted.
 * deadline_date = submitted_at + 30 days
 */
export async function setDeadline(
  db: D1Database,
  requestId: string,
  submittedAt: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE arb_requests
       SET deadline_date = datetime(?, '+30 days')
       WHERE id = ?`
    )
    .bind(submittedAt, requestId)
    .run();
}

// ============================================================================
// Cycle Management (Revision Resubmissions)
// ============================================================================

/**
 * Increment the cycle number when a request is resubmitted after being returned.
 * Previous votes are preserved but a new cycle begins.
 */
export async function incrementCycle(
  db: D1Database,
  requestId: string
): Promise<number> {
  const request = await getArbRequest(db, requestId);
  if (!request) {
    throw new Error('Request not found');
  }

  const newCycle = (request.current_cycle || 1) + 1;

  await db
    .prepare(
      `UPDATE arb_requests
       SET current_cycle = ?
       WHERE id = ?`
    )
    .bind(newCycle, requestId)
    .run();

  return newCycle;
}
