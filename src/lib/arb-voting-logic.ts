/**
 * Pure voting logic functions for ARB multi-stage voting workflow.
 *
 * This module contains the core voting resolution algorithms without database dependencies.
 * This makes it easy to unit test the voting logic in isolation.
 */

export type VoteType = 'APPROVE' | 'DENY' | 'RETURN' | 'ABSTAIN';
export type VoteOutcome = 'PENDING' | 'APPROVED' | 'DENIED' | 'RETURNED' | 'DEADLOCKED';

export interface Vote {
  vote: VoteType;
  voter_email?: string;
}

export interface VoteCalculationResult {
  outcome: VoteOutcome;
  approveCount: number;
  denyCount: number;
  returnCount: number;
  abstainCount: number;
  totalEligible: number;
  activeVoters: number;
  majorityNeeded: number;
  allVotesCast: boolean;
}

/**
 * Calculate vote outcome based on votes cast and total eligible voters.
 *
 * Algorithm:
 * 1. Count approve, deny, return, and abstain votes
 * 2. Calculate active voters = totalEligible - abstainCount
 * 3. Calculate majority = floor(activeVoters / 2) + 1
 * 4. Check if any option has reached majority
 * 5. Return outcome
 *
 * Rules:
 * - Abstentions reduce the pool size (active voters)
 * - Majority = floor(activeVoters / 2) + 1
 * - If all voters abstain, result is DEADLOCKED
 * - If no majority reached, result is PENDING
 *
 * Examples:
 * - 3 eligible, 2 approve, 0 deny, 0 return, 0 abstain → APPROVED (2/3 ≥ 2 majority)
 * - 5 eligible, 3 approve, 0 deny, 0 return, 0 abstain → APPROVED (3/5 ≥ 3 majority)
 * - 3 eligible, 1 approve, 0 deny, 0 return, 1 abstain → PENDING (1/2 < 2 majority)
 * - 3 eligible, 2 approve, 0 deny, 0 return, 1 abstain → APPROVED (2/2 = 2 majority)
 * - 5 eligible, 0 approve, 0 deny, 0 return, 5 abstain → DEADLOCKED (0 active voters)
 */
export function calculateVoteOutcome(
  votes: Vote[],
  totalEligible: number
): VoteCalculationResult {
  // Count votes by type
  const approveCount = votes.filter(v => v.vote === 'APPROVE').length;
  const denyCount = votes.filter(v => v.vote === 'DENY').length;
  const returnCount = votes.filter(v => v.vote === 'RETURN').length;
  const abstainCount = votes.filter(v => v.vote === 'ABSTAIN').length;

  // Calculate active voters (excluding abstentions)
  const activeVoters = totalEligible - abstainCount;

  // Calculate majority threshold
  const majorityNeeded = Math.floor(activeVoters / 2) + 1;

  // Check if all votes are cast
  const allVotesCast = votes.length >= totalEligible;

  // Determine outcome
  let outcome: VoteOutcome = 'PENDING';

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
  // Otherwise remains PENDING

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

/**
 * Check if approval is still mathematically possible.
 * Returns true if enough uncast votes remain to reach approval majority.
 */
export function isApprovalPossible(
  approveCount: number,
  denyCount: number,
  returnCount: number,
  abstainCount: number,
  totalEligible: number
): boolean {
  const activeVoters = totalEligible - abstainCount;
  const majorityNeeded = Math.floor(activeVoters / 2) + 1;
  const votesCast = approveCount + denyCount + returnCount;
  const remainingVotes = activeVoters - votesCast;

  return approveCount + remainingVotes >= majorityNeeded;
}

/**
 * Check if denial is still mathematically possible.
 * Returns true if enough uncast votes remain to reach denial majority.
 */
export function isDenialPossible(
  approveCount: number,
  denyCount: number,
  returnCount: number,
  abstainCount: number,
  totalEligible: number
): boolean {
  const activeVoters = totalEligible - abstainCount;
  const majorityNeeded = Math.floor(activeVoters / 2) + 1;
  const votesCast = approveCount + denyCount + returnCount;
  const remainingVotes = activeVoters - votesCast;

  return denyCount + remainingVotes >= majorityNeeded;
}

/**
 * Check if return is still mathematically possible.
 * Returns true if enough uncast votes remain to reach return majority.
 */
export function isReturnPossible(
  approveCount: number,
  denyCount: number,
  returnCount: number,
  abstainCount: number,
  totalEligible: number
): boolean {
  const activeVoters = totalEligible - abstainCount;
  const majorityNeeded = Math.floor(activeVoters / 2) + 1;
  const votesCast = approveCount + denyCount + returnCount;
  const remainingVotes = activeVoters - votesCast;

  return returnCount + remainingVotes >= majorityNeeded;
}

/**
 * Get a projected outcome hint based on current votes.
 * This is used for UI display only - NOT for auto-resolving votes.
 *
 * Returns one of:
 * - "Approval likely" if approve leads and approval is still possible
 * - "Denial likely" if deny leads and denial is still possible
 * - "Return likely" if return leads and return is still possible
 * - "Too close to call" if multiple outcomes are possible
 * - "Awaiting votes" if not enough votes to project
 */
export function getProjectedOutcome(
  approveCount: number,
  denyCount: number,
  returnCount: number,
  abstainCount: number,
  totalEligible: number
): string {
  const activeVoters = totalEligible - abstainCount;
  const majorityNeeded = Math.floor(activeVoters / 2) + 1;

  // If any option has majority, it will resolve
  if (approveCount >= majorityNeeded) return 'Approval reached';
  if (denyCount >= majorityNeeded) return 'Denial reached';
  if (returnCount >= majorityNeeded) return 'Return reached';

  // Check what's still possible
  const approvalPossible = isApprovalPossible(approveCount, denyCount, returnCount, abstainCount, totalEligible);
  const denialPossible = isDenialPossible(approveCount, denyCount, returnCount, abstainCount, totalEligible);
  const returnPossible = isReturnPossible(approveCount, denyCount, returnCount, abstainCount, totalEligible);

  // If only one outcome is possible
  if (approvalPossible && !denialPossible && !returnPossible) return 'Approval likely (only option remaining)';
  if (denialPossible && !approvalPossible && !returnPossible) return 'Denial likely (only option remaining)';
  if (returnPossible && !approvalPossible && !denialPossible) return 'Return likely (only option remaining)';

  // Multiple outcomes possible - show which is leading
  const maxVotes = Math.max(approveCount, denyCount, returnCount);
  if (maxVotes === 0) return 'Awaiting votes';

  if (approveCount === maxVotes) return 'Approval leading';
  if (denyCount === maxVotes) return 'Denial leading';
  if (returnCount === maxVotes) return 'Return leading';

  return 'Too close to call';
}

/**
 * Format vote counts for display.
 * Example: "2 of 3 votes cast (2 needed for majority)"
 */
export function formatVoteProgress(
  votesCast: number,
  totalEligible: number,
  majorityNeeded: number
): string {
  return `${votesCast} of ${totalEligible} votes cast (${majorityNeeded} needed for majority)`;
}

/**
 * Format deadline date for display with urgency indicator.
 * Returns object with formatted date and urgency level.
 */
export function formatDeadlineWithUrgency(deadlineDate: string): {
  formatted: string;
  daysRemaining: number;
  urgency: 'critical' | 'warning' | 'normal' | 'expired';
} {
  const deadline = new Date(deadlineDate);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let urgency: 'critical' | 'warning' | 'normal' | 'expired';
  if (daysRemaining < 0) {
    urgency = 'expired';
  } else if (daysRemaining <= 3) {
    urgency = 'critical';
  } else if (daysRemaining <= 7) {
    urgency = 'warning';
  } else {
    urgency = 'normal';
  }

  const formatted = deadline.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return { formatted, daysRemaining, urgency };
}
