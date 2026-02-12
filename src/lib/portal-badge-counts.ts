/**
 * Helper to get all badge counts for portal navigation
 * Reduces duplication across portal pages
 */
import type { D1Database } from '@cloudflare/workers-types';
import { getArbRequestCountsByStatus, listArbRequestsByHousehold } from './arb-db';
import { listPendingSubmissions } from './vendor-submissions-db';
import { getOwnerByEmail } from './directory-db';
import { listMaintenanceByHousehold } from './maintenance-db';
import { listUpcomingWithCountsAndUser, householdHasRsvpd } from './meetings-db';
import { listActiveFeedbackDocs, getFeedbackResponse, householdHasResponded } from './feedback-db';

export interface PortalBadgeCounts {
  displayName: string | null;
  draftCount: number;
  arbInReviewCount: number;
  arbPendingCount: number;
  vendorPendingCount: number;
  maintenanceOpenCount: number;
  meetingsRsvpCount: number;
  feedbackDueCount: number;
}

export async function getPortalBadgeCounts(
  db: D1Database | undefined,
  email: string,
  role: string | undefined,
  sessionName: string | null | undefined
): Promise<PortalBadgeCounts> {
  // User display name
  let displayName = sessionName?.trim() || null;
  if (!displayName && db) {
    const owner = await getOwnerByEmail(db, email);
    displayName = owner?.name?.trim() || null;
  }

  // Initialize counts
  let arbCounts: { pending: number; in_review: number } = { pending: 0, in_review: 0 };
  let pendingVendorCount = 0;
  const hasStaffWhitelistRole = role === 'arb' || role === 'board' || role === 'admin' || role === 'arb_board';

  // Load ARB and vendor counts for staff
  if (db && hasStaffWhitelistRole) {
    const counts = await getArbRequestCountsByStatus(db);
    arbCounts = { pending: counts.pending, in_review: counts.in_review };
    const pendingSubmissions = await listPendingSubmissions(db);
    pendingVendorCount = pendingSubmissions.length;
  }

  // Draft count
  const allRequests = db ? await listArbRequestsByHousehold(db, email) : [];
  const draftCount = allRequests.filter((r) => r.status === 'pending').length;

  // Other badge counts
  let maintenanceOpenCount = 0;
  let meetingsRsvpCount = 0;
  let feedbackDueCount = 0;

  if (db) {
    const maintenanceList = await listMaintenanceByHousehold(db, email);
    maintenanceOpenCount = maintenanceList.filter((m) => m.status !== 'completed').length;

    const upcomingMeetings = await listUpcomingWithCountsAndUser(db, email);
    meetingsRsvpCount = 0;
    for (const m of upcomingMeetings) {
      if (m.user_response != null) continue;
      if (await householdHasRsvpd(db, m.id, email)) continue;
      meetingsRsvpCount += 1;
    }

    const activeFeedback = await listActiveFeedbackDocs(db);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    for (const doc of activeFeedback) {
      const resp = await getFeedbackResponse(db, doc.id, email);
      if (resp) continue;
      if (await householdHasResponded(db, doc.id, email)) continue;
      if (doc.deadline == null || doc.deadline <= tomorrowStr) feedbackDueCount += 1;
    }
  }

  return {
    displayName,
    draftCount,
    arbInReviewCount: arbCounts.in_review,
    arbPendingCount: arbCounts.pending,
    vendorPendingCount: pendingVendorCount,
    maintenanceOpenCount,
    meetingsRsvpCount,
    feedbackDueCount,
  };
}
