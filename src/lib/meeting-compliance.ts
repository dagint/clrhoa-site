/**
 * Meeting Notice Compliance Helpers
 *
 * Tracks Florida HOA meeting notice requirements:
 * - Board meetings: 48-hour notice required (§720.303(4)(b)1.h)
 * - Member meetings: 14-day notice + 7-day agenda required (§720.303(4)(b)1.g)
 */

export interface Meeting {
  id: string;
  title: string | null;
  datetime: string | null;
  meeting_type: string | null;
  notice_posted_at: string | null;
  agenda_posted_at: string | null;
  created: string | null;
}

export interface MeetingComplianceStatus {
  meeting: Meeting;
  noticeCompliant: boolean;
  agendaCompliant: boolean;
  noticeHoursEarly: number | null;
  agendaDaysEarly: number | null;
  noticeRequired: boolean;
  agendaRequired: boolean;
  overallCompliant: boolean;
}

/**
 * Check if a meeting's notice posting meets compliance requirements.
 *
 * Requirements:
 * - Board meetings: 48 hours notice
 * - Member meetings: 14 days notice + 7 days agenda
 */
export function checkMeetingCompliance(meeting: Meeting): MeetingComplianceStatus {
  const meetingDate = meeting.datetime ? new Date(meeting.datetime) : null;
  const noticePosted = meeting.notice_posted_at ? new Date(meeting.notice_posted_at) : null;
  const agendaPosted = meeting.agenda_posted_at ? new Date(meeting.agenda_posted_at) : null;
  const meetingType = meeting.meeting_type?.toLowerCase() || 'board';

  // Determine requirements based on meeting type
  const isBoardMeeting = meetingType === 'board';
  const isMemberMeeting = meetingType === 'member';

  // Required advance notice
  const noticeHoursRequired = isBoardMeeting ? 48 : 14 * 24; // 48 hours or 14 days
  const agendaDaysRequired = isMemberMeeting ? 7 : 0; // 7 days for member meetings

  let noticeCompliant = false;
  let agendaCompliant = true; // Default true (not all meetings require agenda)
  let noticeHoursEarly: number | null = null;
  let agendaDaysEarly: number | null = null;

  if (meetingDate && noticePosted) {
    const msEarly = meetingDate.getTime() - noticePosted.getTime();
    const hoursEarly = msEarly / (1000 * 60 * 60);
    noticeHoursEarly = Math.floor(hoursEarly);
    noticeCompliant = hoursEarly >= noticeHoursRequired;
  }

  if (isMemberMeeting && meetingDate && agendaPosted) {
    const msEarly = meetingDate.getTime() - agendaPosted.getTime();
    const daysEarly = msEarly / (1000 * 60 * 60 * 24);
    agendaDaysEarly = Math.floor(daysEarly);
    agendaCompliant = daysEarly >= agendaDaysRequired;
  }

  const overallCompliant = noticeCompliant && agendaCompliant;

  return {
    meeting,
    noticeCompliant,
    agendaCompliant,
    noticeHoursEarly,
    agendaDaysEarly,
    noticeRequired: true, // All meetings require notice
    agendaRequired: isMemberMeeting,
    overallCompliant,
  };
}

/**
 * Get upcoming meetings with compliance status.
 * Returns meetings scheduled in the future.
 */
export async function getUpcomingMeetingsWithCompliance(
  db: D1Database,
  limit = 10
): Promise<MeetingComplianceStatus[]> {
  const { results } = await db
    .prepare(
      `SELECT id, title, datetime, meeting_type, notice_posted_at, agenda_posted_at, created
       FROM meetings
       WHERE datetime >= datetime('now')
       ORDER BY datetime ASC
       LIMIT ?`
    )
    .bind(limit)
    .all<Meeting>();

  const meetings = results ?? [];
  return meetings.map(checkMeetingCompliance);
}

/**
 * Get recent past meetings with compliance status (for audit).
 * Returns meetings from the last 90 days.
 */
export async function getRecentMeetingsWithCompliance(
  db: D1Database,
  limit = 10
): Promise<MeetingComplianceStatus[]> {
  const { results } = await db
    .prepare(
      `SELECT id, title, datetime, meeting_type, notice_posted_at, agenda_posted_at, created
       FROM meetings
       WHERE datetime < datetime('now')
         AND datetime >= datetime('now', '-90 days')
       ORDER BY datetime DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<Meeting>();

  const meetings = results ?? [];
  return meetings.map(checkMeetingCompliance);
}

/**
 * Format hours/days early for display.
 */
export function formatAdvanceNotice(hoursEarly: number | null, isMemberMeeting: boolean): string {
  if (hoursEarly === null) return 'Not posted';

  if (isMemberMeeting) {
    const days = Math.floor(hoursEarly / 24);
    return `${days} days`;
  } else {
    if (hoursEarly >= 24) {
      const days = Math.floor(hoursEarly / 24);
      return `${days} days`;
    }
    return `${hoursEarly} hours`;
  }
}
