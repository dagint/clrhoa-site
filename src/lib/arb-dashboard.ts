/**
 * ARB dashboard: data loading and pure helpers.
 * Extracted from portal/arb-dashboard.astro to keep the page focused and testable.
 */
/// <reference types="@cloudflare/workers-types" />

import type { ArbRequest, ArbFile } from './arb-db';
import { listAllArbRequests, listArbFilesByRequest, listArbRequestsByHousehold } from './arb-db';
import { listPendingSubmissions } from './vendor-submissions-db';

export type { ArbRequest, ArbFile };

/** Request with year-quarter for grouping completed (approved/rejected). */
export interface ArbRequestWithPeriod extends ArbRequest {
  yearQuarter: string;
}

/** Decision date for grouping completed requests. Uses esign_timestamp; fallback to created. */
export function getYearQuarter(dateStr: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${year}-Q${q}`;
}

export function getFileViewUrl(r2KeysJson: string): string | null {
  try {
    const o = JSON.parse(r2KeysJson) as { originals?: string[]; review?: string[]; archive?: string[] };
    const key = o.originals?.[0] ?? o.review?.[0] ?? o.archive?.[0];
    return key ? `/api/portal/file/${encodeURIComponent(key)}` : null;
  } catch {
    return null;
  }
}

export function getFileViewerUrl(r2KeysJson: string): string | null {
  try {
    const o = JSON.parse(r2KeysJson) as { originals?: string[]; review?: string[]; archive?: string[] };
    const key = o.originals?.[0] ?? o.review?.[0] ?? o.archive?.[0];
    return key ? `/api/portal/file-view?key=${encodeURIComponent(key)}` : null;
  } catch {
    return null;
  }
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic)$/i;
export function isImageFilename(filename: string): boolean {
  return IMAGE_EXT.test(filename);
}

export const APPLICATION_TYPES = [
  'Exterior Paint',
  'Landscape Installation',
  'Swimming Pool',
  'Recreational Equipment',
  'Fencing',
  'Other',
] as const;

export function selectedTypes(applicationType: string | null): string[] {
  return applicationType ? applicationType.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

/** Parse arb_esign (format: "STATUS | Name | email | date") for display. */
export function formatApproval(
  arbEsign: string | null,
  esignTimestamp: string | null
): { status: string; by: string; date: string } | null {
  if (!arbEsign?.trim()) return null;
  const parts = arbEsign.split('|').map((p) => p.trim());
  const status = (parts[0] ?? '').toLowerCase();
  if (status !== 'approved' && status !== 'rejected') return null;
  const by = parts[1] ?? arbEsign;
  const dateStr = esignTimestamp ?? parts[3];
  const date = dateStr
    ? new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  return { status, by, date };
}

export const ITEMS_PER_PAGE = 20;

export interface ArbDashboardData {
  allRequests: ArbRequest[];
  filesByRequestId: Record<string, ArbFile[]>;
  ownerRequests: ArbRequest[];
  draftCount: number;
  arbInReviewCount: number;
  vendorPendingCount: number;
  inReview: ArbRequest[];
  pending: ArbRequest[];
  completedWithPeriod: ArbRequestWithPeriod[];
  completedPage: number;
  completedPaginated: ArbRequestWithPeriod[];
  totalCompletedPages: number;
  periodOptions: { value: string; label: string }[];
}

export async function getArbDashboardData(
  db: D1Database,
  sessionEmail: string,
  pageParam: string = '1'
): Promise<ArbDashboardData> {
  const allRequests = await listAllArbRequests(db);
  const filesByRequestId: Record<string, ArbFile[]> = {};
  for (const req of allRequests) {
    filesByRequestId[req.id] = await listArbFilesByRequest(db, req.id);
  }

  const ownerRequests = await listArbRequestsByHousehold(db, sessionEmail);
  const draftCount = ownerRequests.filter((r) => r.status === 'pending').length;
  const arbInReviewCount = allRequests.filter((r) => r.status === 'in_review').length;
  const vendorPendingCount = (await listPendingSubmissions(db)).length;

  const inReview = allRequests.filter((r) => r.status === 'in_review');
  const pending = allRequests.filter((r) => r.status === 'pending');
  const completed = allRequests.filter((r) => r.status === 'approved' || r.status === 'rejected');
  const completedWithPeriod = completed.map((r) => ({
    ...r,
    yearQuarter: getYearQuarter(r.esign_timestamp ?? r.created),
  }));

  const completedPage = Math.max(1, parseInt(pageParam, 10) || 1);
  const completedStart = (completedPage - 1) * ITEMS_PER_PAGE;
  const completedEnd = completedStart + ITEMS_PER_PAGE;
  const completedPaginated = completedWithPeriod.slice(completedStart, completedEnd);
  const totalCompletedPages = Math.ceil(completedWithPeriod.length / ITEMS_PER_PAGE);

  const periodSet = new Set(completedWithPeriod.map((r) => r.yearQuarter));
  const periodOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'All' },
    ...Array.from(periodSet)
      .sort()
      .reverse()
      .map((q) => ({ value: q, label: q.replace('-', ' ') })),
  ];

  return {
    allRequests,
    filesByRequestId,
    ownerRequests,
    draftCount,
    arbInReviewCount,
    vendorPendingCount,
    inReview,
    pending,
    completedWithPeriod,
    completedPage,
    completedPaginated,
    totalCompletedPages,
    periodOptions,
  };
}
