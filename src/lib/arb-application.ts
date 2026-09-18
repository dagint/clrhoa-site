/**
 * ARB application form fields (mirrors the "Architectural Review Application" PDF):
 * "Application For" categories, the "Other:" description, the owner's attachments
 * checklist, and the ARB decision summary printed on the form.
 *
 * Categories, the Other text, and checklist items share the existing
 * arb_requests.application_type column as a comma-separated list:
 *   "Fencing, Other, Other: Pergola, Attached: Lot survey showing location of installation"
 * Requests saved before this format only contain category names and parse unchanged.
 */

export const APPLICATION_TYPES = [
  'Exterior Paint',
  'Landscape Installation',
  'Swimming Pool',
  'Recreational Equipment',
  'Fencing',
  'Other',
] as const;

export const ATTACHMENT_CHECKLIST = [
  'Written description of project',
  'Lot survey showing location of installation',
  'Specifications (plans, dimensions, materials, colors)',
  'Paint chip / color samples',
  'Other (e.g. pictures, brochures, etc.)',
] as const;

const OTHER_PREFIX = 'Other: ';
const ATTACHED_PREFIX = 'Attached: ';
export const OTHER_TEXT_MAX_LENGTH = 100;

export interface ApplicationDetails {
  types: string[];
  otherText: string | null;
  attachments: string[];
}

/** Commas separate list entries, so replace them; collapse whitespace; cap length. */
function cleanOtherText(text: string | null | undefined): string | null {
  const cleaned = (text ?? '').replace(/,/g, ';').replace(/\s+/g, ' ').trim().slice(0, OTHER_TEXT_MAX_LENGTH).trim();
  return cleaned || null;
}

export function parseApplicationType(value: string | null | undefined): ApplicationDetails {
  const details: ApplicationDetails = { types: [], otherText: null, attachments: [] };
  for (const token of (value ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (token.startsWith(OTHER_PREFIX)) {
      details.otherText = token.slice(OTHER_PREFIX.length).trim() || null;
    } else if (token.startsWith(ATTACHED_PREFIX)) {
      const item = token.slice(ATTACHED_PREFIX.length).trim();
      if ((ATTACHMENT_CHECKLIST as readonly string[]).includes(item) && !details.attachments.includes(item)) {
        details.attachments.push(item);
      }
    } else if ((APPLICATION_TYPES as readonly string[]).includes(token) && !details.types.includes(token)) {
      details.types.push(token);
    }
  }
  if (details.otherText && !details.types.includes('Other')) details.types.push('Other');
  return details;
}

/** Serialize to the application_type column. Unknown categories/checklist items are dropped. */
export function serializeApplicationType(details: {
  types?: readonly string[];
  otherText?: string | null;
  attachments?: readonly string[];
}): string | null {
  const otherText = cleanOtherText(details.otherText);
  const types = APPLICATION_TYPES.filter((t) => details.types?.includes(t) || (t === 'Other' && otherText));
  const attachments = ATTACHMENT_CHECKLIST.filter((a) => details.attachments?.includes(a));
  const tokens = [
    ...types,
    ...(otherText ? [OTHER_PREFIX + otherText] : []),
    ...attachments.map((a) => ATTACHED_PREFIX + a),
  ];
  return tokens.length > 0 ? tokens.join(', ') : null;
}

/** Read the form fields `application_type`, `application_other`, and `attachments_checklist`. */
export function applicationTypeFromForm(formData: FormData): string | null {
  return serializeApplicationType({
    types: formData.getAll('application_type').map((t) => String(t).trim()),
    otherText: formData.get('application_other') as string | null,
    attachments: formData.getAll('attachments_checklist').map((a) => String(a).trim()),
  });
}

/** Human-readable categories, e.g. "Fencing, Other (Pergola)". */
export function formatApplicationTypes(value: string | null | undefined): string {
  const { types, otherText } = parseApplicationType(value);
  return types.map((t) => (t === 'Other' && otherText ? `Other (${otherText})` : t)).join(', ');
}

// ---------------------------------------------------------------------------
// ARB decision summary ("THIS SECTION TO BE COMPLETED BY ARCHITECTURAL REVIEW BOARD")
// ---------------------------------------------------------------------------

export type StageResult = 'Pending' | 'Approved' | 'Denied' | 'Returned for revision' | 'Not reached';

export interface ArbDecisionSummary {
  receivedDate: string | null;
  approvedDate: string | null;
  deniedDate: string | null;
  /** ARB/ARC majority result (workflow v2), or the single ARB decision (legacy v1). */
  arcResult: StageResult;
  /** Board majority result; null for legacy v1 requests, which had no Board stage. */
  boardResult: StageResult | null;
  autoApproved: boolean;
}

interface DecisionFields {
  status: string;
  created: string;
  workflow_version?: number | null;
  current_stage?: string | null;
  submitted_at?: string | null;
  resolved_at?: string | null;
  esign_timestamp?: string | null;
  auto_approved_reason?: string | null;
}

const ARC_RESULT_BY_STAGE: Record<string, StageResult> = {
  SUBMITTED: 'Pending',
  ARC_REVIEW: 'Pending',
  ARC_APPROVED: 'Approved',
  ARC_DENIED: 'Denied',
  ARC_RETURNED: 'Returned for revision',
  BOARD_REVIEW: 'Approved',
  BOARD_APPROVED: 'Approved',
  BOARD_DENIED: 'Approved',
  BOARD_RETURNED: 'Approved',
};

const BOARD_RESULT_BY_STAGE: Record<string, StageResult> = {
  BOARD_REVIEW: 'Pending',
  BOARD_APPROVED: 'Approved',
  BOARD_DENIED: 'Denied',
  BOARD_RETURNED: 'Returned for revision',
};

export function getArbDecisionSummary(req: DecisionFields): ArbDecisionSummary {
  const isV2 = (req.workflow_version ?? 1) >= 2;

  if (isV2) {
    const stage = req.current_stage || req.status;
    const approved = stage === 'BOARD_APPROVED';
    const denied = stage === 'BOARD_DENIED' || stage === 'ARC_DENIED';
    return {
      receivedDate: req.submitted_at || null,
      approvedDate: approved ? req.resolved_at || null : null,
      deniedDate: denied ? req.resolved_at || null : null,
      arcResult: ARC_RESULT_BY_STAGE[stage] ?? 'Not reached',
      boardResult: BOARD_RESULT_BY_STAGE[stage] ?? 'Not reached',
      autoApproved: approved && req.auto_approved_reason === 'deadline_expired',
    };
  }

  const status = req.status.toLowerCase();
  const v1Result: Record<string, StageResult> = {
    pending: 'Pending',
    in_review: 'Pending',
    approved: 'Approved',
    rejected: 'Denied',
  };
  return {
    receivedDate: status === 'draft' ? null : req.created,
    approvedDate: status === 'approved' ? req.esign_timestamp || null : null,
    deniedDate: status === 'rejected' ? req.esign_timestamp || null : null,
    arcResult: v1Result[status] ?? 'Not reached',
    boardResult: null,
    autoApproved: false,
  };
}
