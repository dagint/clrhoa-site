/**
 * D1 helpers for meetings and RSVPs (Phase 4).
 */

import { listEmailsAtSameAddress } from './directory-db.js';

export interface Meeting {
  id: string;
  title: string | null;
  description: string | null;
  datetime: string;
  location: string | null;
  agenda_r2_key: string | null;
  post_to_public_news: number;
  created_by: string | null;
  created: string;
}

export interface MeetingRsvp {
  meeting_id: string;
  owner_email: string;
  response: string;
  timestamp: string;
}

export interface MeetingWithCounts extends Meeting {
  yes_count: number;
  no_count: number;
  maybe_count: number;
  user_response: string | null;
}

const ID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function generateId(len: number = 12): string {
  const bytes = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  let id = '';
  for (let i = 0; i < len; i++) id += ID_CHARS[bytes[i]! % ID_CHARS.length];
  return id;
}

export function createMeetingId(): string {
  return `mtg_${generateId(14)}`;
}

const MEETING_SELECT =
  'id, title, description, datetime, location, agenda_r2_key, COALESCE(post_to_public_news, 0) as post_to_public_news, created_by, created';

/** List upcoming meetings (datetime >= now), sorted by datetime. */
export async function listUpcomingMeetings(db: D1Database): Promise<Meeting[]> {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const result = await db
    .prepare(
      `SELECT ${MEETING_SELECT} FROM meetings WHERE datetime >= ? ORDER BY datetime ASC`
    )
    .bind(now)
    .all<Meeting>();
  return result.results ?? [];
}

/** Upcoming meetings with RSVP counts and optional current user response. */
export async function listUpcomingWithCountsAndUser(
  db: D1Database,
  userEmail: string | null
): Promise<MeetingWithCounts[]> {
  const meetings = await listUpcomingMeetings(db);
  const result: MeetingWithCounts[] = [];
  for (const m of meetings) {
    const counts = await getRsvpCounts(db, m.id);
    const user_response = userEmail ? await getUserRsvp(db, m.id, userEmail) : null;
    result.push({
      ...m,
      yes_count: counts.yes,
      no_count: counts.no,
      maybe_count: counts.maybe,
      user_response,
    });
  }
  return result;
}

/** List all meetings for board (past and future), sorted by datetime desc. */
export async function listAllMeetings(db: D1Database, limit = 500, offset = 0): Promise<Meeting[]> {
  const safeLimit = Math.max(1, Math.min(limit, 1000));
  const safeOffset = Math.max(0, offset);
  const result = await db
    .prepare(
      `SELECT ${MEETING_SELECT} FROM meetings ORDER BY datetime DESC LIMIT ? OFFSET ?`
    )
    .bind(safeLimit, safeOffset)
    .all<Meeting>();
  return result.results ?? [];
}

/** Get one meeting by id. */
export async function getMeetingById(db: D1Database, id: string): Promise<Meeting | null> {
  return db
    .prepare(
      `SELECT ${MEETING_SELECT} FROM meetings WHERE id = ? LIMIT 1`
    )
    .bind(id)
    .first<Meeting>();
}

/** List meetings that are posted to public news (for public News page). */
export async function listMeetingsForPublicNews(db: D1Database): Promise<Meeting[]> {
  const result = await db
    .prepare(
      `SELECT ${MEETING_SELECT} FROM meetings WHERE COALESCE(post_to_public_news, 0) = 1 ORDER BY datetime DESC`
    )
    .all<Meeting>();
  return result.results ?? [];
}

/** Get a single meeting by id only if it is posted to public news (for public detail page). */
export async function getPublicMeetingById(db: D1Database, id: string): Promise<Meeting | null> {
  return db
    .prepare(
      `SELECT ${MEETING_SELECT} FROM meetings WHERE id = ? AND COALESCE(post_to_public_news, 0) = 1 LIMIT 1`
    )
    .bind(id)
    .first<Meeting>();
}

/** Get RSVP counts for a meeting. */
export async function getRsvpCounts(
  db: D1Database,
  meetingId: string
): Promise<{ yes: number; no: number; maybe: number }> {
  const rows = await db
    .prepare(
      `SELECT response, COUNT(*) as c FROM meeting_rsvps WHERE meeting_id = ? GROUP BY response`
    )
    .bind(meetingId)
    .all<{ response: string; c: number }>();
  const counts = { yes: 0, no: 0, maybe: 0 };
  for (const r of rows.results ?? []) {
    const k = r.response?.toLowerCase();
    if (k === 'yes') counts.yes = r.c;
    else if (k === 'no') counts.no = r.c;
    else if (k === 'maybe') counts.maybe = r.c;
  }
  return counts;
}

/** Get current user's RSVP for a meeting. */
export async function getUserRsvp(
  db: D1Database,
  meetingId: string,
  email: string
): Promise<string | null> {
  const row = await db
    .prepare(`SELECT response FROM meeting_rsvps WHERE meeting_id = ? AND owner_email = ? LIMIT 1`)
    .bind(meetingId, email.trim().toLowerCase())
    .first<{ response: string }>();
  return row?.response ?? null;
}

/** True if any member of the household (same address) has RSVP'd for this meeting. */
export async function householdHasRsvpd(
  db: D1Database,
  meetingId: string,
  userEmail: string
): Promise<boolean> {
  const emails = await listEmailsAtSameAddress(db, userEmail);
  if (emails.length === 0) return false;
  const placeholders = emails.map(() => '?').join(',');
  const row = await db
    .prepare(
      `SELECT 1 FROM meeting_rsvps WHERE meeting_id = ? AND owner_email IN (${placeholders}) LIMIT 1`
    )
    .bind(meetingId, ...emails)
    .first<{ '1'?: number }>();
  return row != null;
}

/** RSVPs from all household members for a meeting. */
export interface HouseholdRsvp {
  owner_email: string;
  response: string;
}

export async function getHouseholdRsvps(
  db: D1Database,
  meetingId: string,
  userEmail: string
): Promise<HouseholdRsvp[]> {
  const emails = await listEmailsAtSameAddress(db, userEmail);
  if (emails.length === 0) return [];
  const placeholders = emails.map(() => '?').join(',');
  const { results } = await db
    .prepare(
      `SELECT owner_email, response FROM meeting_rsvps WHERE meeting_id = ? AND owner_email IN (${placeholders})`
    )
    .bind(meetingId, ...emails)
    .all<HouseholdRsvp>();
  return results ?? [];
}

/** Upsert RSVP. */
export async function setRsvp(
  db: D1Database,
  meetingId: string,
  ownerEmail: string,
  response: string
): Promise<void> {
  const email = ownerEmail.trim().toLowerCase();
  const resp = response?.toLowerCase() === 'yes' ? 'yes' : response?.toLowerCase() === 'no' ? 'no' : 'maybe';
  await db
    .prepare(
      `INSERT INTO meeting_rsvps (meeting_id, owner_email, response, timestamp)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(meeting_id, owner_email) DO UPDATE SET response = excluded.response, timestamp = datetime('now')`
    )
    .bind(meetingId, email, resp)
    .run();
}

/** Create meeting. */
export async function insertMeeting(
  db: D1Database,
  id: string,
  data: {
    title: string;
    description: string | null;
    datetime: string;
    location: string | null;
    agenda_r2_key?: string | null;
    post_to_public_news?: number;
    created_by: string;
  }
): Promise<void> {
  const postToPublic = data.post_to_public_news ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO meetings (id, title, description, datetime, location, agenda_r2_key, post_to_public_news, created_by, created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id,
      data.title?.trim() ?? '',
      data.description?.trim() || null,
      data.datetime,
      data.location?.trim() || null,
      data.agenda_r2_key ?? null,
      postToPublic,
      data.created_by
    )
    .run();
}

/** Update meeting. */
export async function updateMeeting(
  db: D1Database,
  id: string,
  data: {
    title?: string;
    description?: string | null;
    datetime?: string;
    location?: string | null;
    agenda_r2_key?: string | null;
    post_to_public_news?: number;
  }
): Promise<boolean> {
  const meeting = await getMeetingById(db, id);
  if (!meeting) return false;
  const postToPublic =
    data.post_to_public_news !== undefined ? (data.post_to_public_news ? 1 : 0) : meeting.post_to_public_news;
  await db
    .prepare(
      `UPDATE meetings SET
        title = COALESCE(?, title),
        description = ?,
        datetime = COALESCE(?, datetime),
        location = ?,
        agenda_r2_key = ?,
        post_to_public_news = ?
       WHERE id = ?`
    )
    .bind(
      data.title !== undefined ? data.title.trim() : meeting.title,
      data.description !== undefined ? (data.description?.trim() || null) : meeting.description,
      data.datetime ?? meeting.datetime,
      data.location !== undefined ? (data.location?.trim() || null) : meeting.location,
      data.agenda_r2_key !== undefined ? data.agenda_r2_key : meeting.agenda_r2_key,
      postToPublic,
      id
    )
    .run();
  return true;
}

/** Delete meeting (and its RSVPs). */
export async function deleteMeeting(db: D1Database, id: string): Promise<boolean> {
  await db.prepare(`DELETE FROM meeting_rsvps WHERE meeting_id = ?`).bind(id).run();
  const r = await db.prepare(`DELETE FROM meetings WHERE id = ?`).bind(id).run();
  return r.meta.changes > 0;
}
