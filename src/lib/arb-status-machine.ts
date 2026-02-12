/**
 * Status transition validator for ARB multi-stage voting workflow.
 *
 * This module enforces the allowed state transitions according to the workflow spec:
 * DRAFT → SUBMITTED → ARC_REVIEW → ARC_APPROVED → BOARD_REVIEW → BOARD_APPROVED
 *             │                         │                              │
 *             ├─→ ARC_RETURNED           ├─→ ARC_DENIED               ├─→ BOARD_RETURNED
 *             └─→ (cancel)               └─→ (appeal out of scope)    └─→ BOARD_DENIED
 */

// ============================================================================
// Status and Stage Types
// ============================================================================

export type WorkflowStatus =
  // Multi-stage voting workflow (v2) statuses
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ARC_REVIEW'
  | 'ARC_APPROVED'
  | 'ARC_DENIED'
  | 'ARC_RETURNED'
  | 'BOARD_REVIEW'
  | 'BOARD_APPROVED'
  | 'BOARD_DENIED'
  | 'BOARD_RETURNED'
  // Legacy workflow (v1) statuses
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type WorkflowStage =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ARC_REVIEW'
  | 'ARC_APPROVED'
  | 'ARC_DENIED'
  | 'ARC_RETURNED'
  | 'BOARD_REVIEW'
  | 'BOARD_APPROVED'
  | 'BOARD_DENIED'
  | 'BOARD_RETURNED';

// ============================================================================
// Allowed Transitions
// ============================================================================

/**
 * Map of allowed transitions for workflow v2 (multi-stage voting).
 * Key = current status, Value = array of allowed next statuses.
 */
const ALLOWED_TRANSITIONS_V2: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'cancelled'], // Owner can submit or cancel
  SUBMITTED: ['ARC_REVIEW', 'cancelled'], // ARC can begin review, owner can cancel
  ARC_REVIEW: ['ARC_APPROVED', 'ARC_DENIED', 'ARC_RETURNED'], // ARC vote outcomes
  ARC_RETURNED: ['SUBMITTED'], // Owner resubmits
  ARC_DENIED: [], // Terminal (unless appeal, out of scope)
  ARC_APPROVED: ['BOARD_REVIEW'], // Automatic advancement
  BOARD_REVIEW: ['BOARD_APPROVED', 'BOARD_DENIED', 'BOARD_RETURNED'], // Board vote outcomes
  BOARD_RETURNED: ['SUBMITTED'], // Owner resubmits, goes through ARC again
  BOARD_DENIED: [], // Terminal (unless appeal, out of scope)
  BOARD_APPROVED: [], // Terminal success state
  cancelled: [], // Terminal
};

/**
 * Map of allowed transitions for workflow v1 (legacy single-reviewer).
 * Preserved for backward compatibility with existing requests.
 */
const ALLOWED_TRANSITIONS_V1: Record<string, string[]> = {
  pending: ['in_review', 'cancelled'],
  in_review: ['approved', 'rejected', 'pending'], // pending = returned for revision
  approved: [],
  rejected: [],
  cancelled: [],
};

// ============================================================================
// Terminal Statuses
// ============================================================================

/**
 * Terminal statuses that cannot be changed (final states).
 */
const TERMINAL_STATUSES_V2 = new Set([
  'ARC_DENIED',
  'BOARD_DENIED',
  'BOARD_APPROVED',
  'cancelled',
]);

const TERMINAL_STATUSES_V1 = new Set(['approved', 'rejected', 'cancelled']);

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if a status transition is allowed.
 *
 * @param fromStatus - Current status
 * @param toStatus - Desired new status
 * @param workflowVersion - Workflow version (1 = legacy, 2 = multi-stage)
 * @returns Object with { allowed: boolean, reason?: string }
 */
export function canTransitionStatus(
  fromStatus: string,
  toStatus: string,
  workflowVersion: number
): { allowed: boolean; reason?: string } {
  // Normalize status strings
  const from = fromStatus?.trim() || '';
  const to = toStatus?.trim() || '';

  if (!from || !to) {
    return { allowed: false, reason: 'Invalid status values' };
  }

  // Same status = no-op (allowed)
  if (from === to) {
    return { allowed: true };
  }

  // Select transition map based on workflow version
  const transitions = workflowVersion === 2 ? ALLOWED_TRANSITIONS_V2 : ALLOWED_TRANSITIONS_V1;
  const terminalStatuses = workflowVersion === 2 ? TERMINAL_STATUSES_V2 : TERMINAL_STATUSES_V1;

  // Check if current status is terminal
  if (terminalStatuses.has(from)) {
    return {
      allowed: false,
      reason: `Cannot transition from terminal status "${from}"`,
    };
  }

  // Check if transition is in allowed list
  const allowedNext = transitions[from];
  if (!allowedNext) {
    return {
      allowed: false,
      reason: `Unknown status "${from}"`,
    };
  }

  if (!allowedNext.includes(to)) {
    return {
      allowed: false,
      reason: `Transition from "${from}" to "${to}" is not allowed. Allowed: ${allowedNext.join(', ')}`,
    };
  }

  return { allowed: true };
}

/**
 * Get list of allowed next statuses for a given current status.
 *
 * @param currentStatus - Current status
 * @param workflowVersion - Workflow version (1 = legacy, 2 = multi-stage)
 * @returns Array of allowed next status strings
 */
export function getAllowedNextStatuses(
  currentStatus: string,
  workflowVersion: number
): string[] {
  const transitions = workflowVersion === 2 ? ALLOWED_TRANSITIONS_V2 : ALLOWED_TRANSITIONS_V1;
  return transitions[currentStatus] ?? [];
}

/**
 * Check if a status is terminal (final state).
 *
 * @param status - Status to check
 * @param workflowVersion - Workflow version (1 = legacy, 2 = multi-stage)
 * @returns True if terminal, false otherwise
 */
export function isTerminalStatus(status: string, workflowVersion: number): boolean {
  const terminalStatuses = workflowVersion === 2 ? TERMINAL_STATUSES_V2 : TERMINAL_STATUSES_V1;
  return terminalStatuses.has(status);
}

/**
 * Check if a status is in a review stage (requires voting).
 *
 * @param status - Status to check
 * @returns True if in review stage, false otherwise
 */
export function isReviewStage(status: string): boolean {
  return status === 'ARC_REVIEW' || status === 'BOARD_REVIEW';
}

/**
 * Check if a status allows owner to edit the request.
 *
 * @param status - Status to check
 * @param workflowVersion - Workflow version (1 = legacy, 2 = multi-stage)
 * @returns True if owner can edit, false otherwise
 */
export function canOwnerEdit(status: string, workflowVersion: number): boolean {
  if (workflowVersion === 2) {
    // V2: Owner can edit in DRAFT, ARC_RETURNED, and BOARD_RETURNED
    return status === 'DRAFT' || status === 'ARC_RETURNED' || status === 'BOARD_RETURNED';
  } else {
    // V1: Owner can edit in pending
    return status === 'pending';
  }
}

/**
 * Get human-readable label for a status.
 *
 * @param status - Status code
 * @returns Human-readable label
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    // V2 statuses
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    ARC_REVIEW: 'ARC Review',
    ARC_APPROVED: 'ARC Approved',
    ARC_DENIED: 'ARC Denied',
    ARC_RETURNED: 'Returned by ARC',
    BOARD_REVIEW: 'Board Review',
    BOARD_APPROVED: 'Approved',
    BOARD_DENIED: 'Denied',
    BOARD_RETURNED: 'Returned by Board',
    // V1 statuses
    pending: 'Pending',
    in_review: 'In Review',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };

  return labels[status] ?? status;
}

/**
 * Get color indicator for a status (for UI styling).
 *
 * @param status - Status code
 * @returns Color name: 'gray' | 'blue' | 'green' | 'red' | 'yellow'
 */
export function getStatusColor(status: string): 'gray' | 'blue' | 'green' | 'red' | 'yellow' {
  const approved = ['ARC_APPROVED', 'BOARD_APPROVED', 'approved'];
  const denied = ['ARC_DENIED', 'BOARD_DENIED', 'rejected'];
  const returned = ['ARC_RETURNED', 'BOARD_RETURNED'];
  const review = ['ARC_REVIEW', 'BOARD_REVIEW', 'in_review'];
  const draft = ['DRAFT', 'pending'];

  if (approved.includes(status)) return 'green';
  if (denied.includes(status)) return 'red';
  if (returned.includes(status)) return 'yellow';
  if (review.includes(status)) return 'blue';
  if (draft.includes(status)) return 'gray';

  return 'gray';
}

/**
 * Map legacy v1 status to equivalent v2 status (for migration/compatibility).
 *
 * @param v1Status - V1 status
 * @returns Equivalent V2 status
 */
export function mapV1ToV2Status(v1Status: string): string {
  const mapping: Record<string, string> = {
    pending: 'DRAFT',
    in_review: 'ARC_REVIEW',
    approved: 'BOARD_APPROVED',
    rejected: 'BOARD_DENIED',
    cancelled: 'cancelled',
  };

  return mapping[v1Status] ?? v1Status;
}

/**
 * Validate a complete workflow transition including actor permissions.
 *
 * @param fromStatus - Current status
 * @param toStatus - Desired new status
 * @param workflowVersion - Workflow version
 * @param actorRole - Role of the user attempting the transition
 * @returns Object with { allowed: boolean, reason?: string }
 */
export function validateTransition(
  fromStatus: string,
  toStatus: string,
  workflowVersion: number,
  actorRole: 'owner' | 'arc' | 'board' | 'system'
): { allowed: boolean; reason?: string } {
  // First check if transition is allowed by state machine
  const transitionCheck = canTransitionStatus(fromStatus, toStatus, workflowVersion);
  if (!transitionCheck.allowed) {
    return transitionCheck;
  }

  // Check actor permissions for this transition
  if (workflowVersion === 2) {
    // Owner transitions
    if (actorRole === 'owner') {
      const ownerAllowed = ['DRAFT→SUBMITTED', 'ARC_RETURNED→SUBMITTED', 'BOARD_RETURNED→SUBMITTED'];
      const transition = `${fromStatus}→${toStatus}`;
      if (!ownerAllowed.includes(transition) && toStatus !== 'cancelled') {
        return {
          allowed: false,
          reason: 'Only reviewers can perform this transition',
        };
      }
    }

    // ARC transitions
    if (actorRole === 'arc') {
      const arcAllowed = ['SUBMITTED→ARC_REVIEW'];
      const arcVoteOutcomes = ['ARC_REVIEW→ARC_APPROVED', 'ARC_REVIEW→ARC_DENIED', 'ARC_REVIEW→ARC_RETURNED'];
      const transition = `${fromStatus}→${toStatus}`;
      if (!arcAllowed.includes(transition) && !arcVoteOutcomes.includes(transition)) {
        return {
          allowed: false,
          reason: 'ARC members can only begin ARC review or resolve ARC votes',
        };
      }
    }

    // Board transitions
    if (actorRole === 'board') {
      const boardVoteOutcomes = ['BOARD_REVIEW→BOARD_APPROVED', 'BOARD_REVIEW→BOARD_DENIED', 'BOARD_REVIEW→BOARD_RETURNED'];
      const transition = `${fromStatus}→${toStatus}`;
      if (!boardVoteOutcomes.includes(transition)) {
        return {
          allowed: false,
          reason: 'Board members can only resolve Board votes',
        };
      }
    }

    // System transitions (auto-approval, auto-advancement)
    if (actorRole === 'system') {
      const systemAllowed = [
        'ARC_REVIEW→ARC_APPROVED', // deadline auto-approval
        'BOARD_REVIEW→BOARD_APPROVED', // deadline auto-approval
        'ARC_APPROVED→BOARD_REVIEW', // automatic advancement
      ];
      const transition = `${fromStatus}→${toStatus}`;
      if (!systemAllowed.includes(transition)) {
        return {
          allowed: false,
          reason: 'System can only perform auto-approvals and auto-advancements',
        };
      }
    }
  }

  return { allowed: true };
}
