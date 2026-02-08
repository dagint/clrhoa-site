/**
 * Portal search: ARB, meetings, vendors, owners, feedback_docs, preapproval (library). Used by /api/search and /portal/search.
 */

export interface SearchSession {
  email: string;
  role: string;
}

export interface SearchArbItem {
  id: string;
  description: string;
  application_type: string | null;
  status: string;
}

export interface SearchMeetingItem {
  id: string;
  title: string | null;
  datetime: string;
}

export interface SearchVendorItem {
  id: string;
  name: string | null;
  category: string | null;
}

export interface SearchOwnerItem {
  id: string;
  name: string | null;
  address: string | null;
}

export interface SearchFeedbackDocItem {
  id: string;
  title: string | null;
  description: string | null;
}

export interface SearchPreapprovalItem {
  id: string;
  category: string | null;
  title: string | null;
  description: string | null;
  rules: string | null;
}

export interface SearchResult {
  arb: SearchArbItem[];
  meetings: SearchMeetingItem[];
  vendors: SearchVendorItem[];
  owners: SearchOwnerItem[];
  feedback_docs: SearchFeedbackDocItem[];
  preapproval: SearchPreapprovalItem[];
}

export async function runPortalSearch(
  db: D1Database,
  q: string,
  session: SearchSession
): Promise<SearchResult> {
  const trimmed = q.trim().slice(0, 100);
  if (!trimmed) {
    return { arb: [], meetings: [], vendors: [], owners: [], feedback_docs: [], preapproval: [] };
  }

  const like = `%${trimmed}%`;
  const isStaff = session.role === 'board' || session.role === 'admin' || session.role === 'arb' || session.role === 'arb_board';
  const email = session.email.trim().toLowerCase();

  const arbSql = isStaff
    ? `SELECT id, description, application_type, status FROM arb_requests WHERE (deleted_at IS NULL OR deleted_at = "") AND (description LIKE ? OR application_type LIKE ?) ORDER BY created DESC LIMIT 20`
    : `SELECT id, description, application_type, status FROM arb_requests WHERE (deleted_at IS NULL OR deleted_at = "") AND owner_email = ? AND (description LIKE ? OR application_type LIKE ?) ORDER BY created DESC LIMIT 20`;
  const arbBind = isStaff ? [like, like] : [email, like, like];

  const [arbRes, mtgRes, venRes, ownRes, feedbackRes, preapprovalRes] = await Promise.all([
    db.prepare(arbSql).bind(...arbBind).all(),
    db.prepare(
      `SELECT id, title, datetime FROM meetings WHERE title LIKE ? OR description LIKE ? ORDER BY datetime DESC LIMIT 20`
    ).bind(like, like).all(),
    db.prepare(
      `SELECT id, name, category FROM vendors WHERE name LIKE ? OR category LIKE ? OR notes LIKE ? ORDER BY name ASC LIMIT 20`
    ).bind(like, like, like).all(),
    db.prepare(
      `SELECT id, name, address FROM owners WHERE name LIKE ? OR address LIKE ? ORDER BY name ASC LIMIT 20`
    ).bind(like, like).all(),
    db.prepare(
      `SELECT id, title, description FROM feedback_docs WHERE title LIKE ? OR description LIKE ? ORDER BY created DESC LIMIT 20`
    ).bind(like, like).all(),
    db.prepare(
      `SELECT id, category, title, description, rules FROM preapproval_items WHERE (title LIKE ? OR description LIKE ? OR rules LIKE ? OR category LIKE ?) AND COALESCE(approved, 1) = 1 ORDER BY created DESC LIMIT 20`
    ).bind(like, like, like, like).all().catch(() => ({ results: [] })),
  ]);

  return {
    arb: (arbRes.results ?? []) as SearchArbItem[],
    meetings: (mtgRes.results ?? []) as SearchMeetingItem[],
    vendors: (venRes.results ?? []) as SearchVendorItem[],
    owners: (ownRes.results ?? []) as SearchOwnerItem[],
    feedback_docs: (feedbackRes.results ?? []) as SearchFeedbackDocItem[],
    preapproval: (preapprovalRes?.results ?? []) as SearchPreapprovalItem[],
  };
}
