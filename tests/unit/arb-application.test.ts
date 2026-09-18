/**
 * Unit tests for src/lib/arb-application.ts (ARB application form fields and decision summary).
 */

import { describe, it, expect } from 'vitest';
import {
  applicationTypeFromForm,
  formatApplicationTypes,
  getArbDecisionSummary,
  parseApplicationType,
  serializeApplicationType,
  OTHER_TEXT_MAX_LENGTH,
} from '../../src/lib/arb-application';

describe('parseApplicationType', () => {
  it('parses legacy values that only contain categories', () => {
    expect(parseApplicationType('Exterior Paint, Fencing')).toEqual({
      types: ['Exterior Paint', 'Fencing'],
      otherText: null,
      attachments: [],
    });
  });

  it('handles empty values', () => {
    expect(parseApplicationType(null)).toEqual({ types: [], otherText: null, attachments: [] });
    expect(parseApplicationType('')).toEqual({ types: [], otherText: null, attachments: [] });
  });

  it('parses Other text and attachments', () => {
    expect(
      parseApplicationType('Fencing, Other, Other: Pergola, Attached: Paint chip / color samples')
    ).toEqual({ types: ['Fencing', 'Other'], otherText: 'Pergola', attachments: ['Paint chip / color samples'] });
  });

  it('ignores unknown categories and checklist items', () => {
    expect(parseApplicationType('Fencing, Rocket Launch, Attached: Bribe')).toEqual({
      types: ['Fencing'],
      otherText: null,
      attachments: [],
    });
  });

  it('implies Other when Other text is present', () => {
    expect(parseApplicationType('Other: Solar panels').types).toEqual(['Other']);
  });
});

describe('serializeApplicationType', () => {
  it('round-trips through parseApplicationType', () => {
    const details = {
      types: ['Swimming Pool', 'Other'],
      otherText: 'Screen enclosure',
      attachments: ['Written description of project', 'Lot survey showing location of installation'],
    };
    expect(parseApplicationType(serializeApplicationType(details))).toEqual(details);
  });

  it('orders categories and checklist items like the paper form', () => {
    expect(serializeApplicationType({ types: ['Fencing', 'Exterior Paint'] })).toBe('Exterior Paint, Fencing');
  });

  it('replaces commas in Other text so the list stays parseable', () => {
    const stored = serializeApplicationType({ otherText: 'Pergola, 10x12, cedar' });
    expect(stored).toBe('Other, Other: Pergola; 10x12; cedar');
    expect(parseApplicationType(stored).otherText).toBe('Pergola; 10x12; cedar');
  });

  it('caps Other text length', () => {
    const stored = serializeApplicationType({ otherText: 'x'.repeat(500) });
    expect(parseApplicationType(stored).otherText).toHaveLength(OTHER_TEXT_MAX_LENGTH);
  });

  it('returns null when nothing is selected', () => {
    expect(serializeApplicationType({ types: [], otherText: '  ', attachments: [] })).toBeNull();
  });
});

describe('applicationTypeFromForm', () => {
  it('reads categories, Other text, and checklist from form fields', () => {
    const form = new FormData();
    form.append('application_type', 'Fencing');
    form.append('application_type', 'Not A Category');
    form.set('application_other', 'Gate');
    form.append('attachments_checklist', 'Specifications (plans, dimensions, materials, colors)');
    expect(applicationTypeFromForm(form)).toBe(
      'Fencing, Other, Other: Gate, Attached: Specifications (plans, dimensions, materials, colors)'
    );
  });
});

describe('formatApplicationTypes', () => {
  it('shows Other text inline and omits attachments', () => {
    expect(formatApplicationTypes('Fencing, Other, Other: Pergola, Attached: Paint chip / color samples')).toBe(
      'Fencing, Other (Pergola)'
    );
  });
});

describe('getArbDecisionSummary', () => {
  const base = { created: '2026-09-01T12:00:00Z', submitted_at: '2026-09-02T12:00:00Z' };

  it('v2 board approval fills received and approved dates', () => {
    const s = getArbDecisionSummary({
      ...base,
      status: 'BOARD_APPROVED',
      workflow_version: 2,
      current_stage: 'BOARD_APPROVED',
      resolved_at: '2026-09-10T12:00:00Z',
    });
    expect(s).toMatchObject({
      receivedDate: '2026-09-02T12:00:00Z',
      approvedDate: '2026-09-10T12:00:00Z',
      deniedDate: null,
      arcResult: 'Approved',
      boardResult: 'Approved',
      autoApproved: false,
    });
  });

  it('v2 ARC denial never reaches the Board', () => {
    const s = getArbDecisionSummary({
      ...base,
      status: 'ARC_DENIED',
      workflow_version: 2,
      current_stage: 'ARC_DENIED',
      resolved_at: '2026-09-05T12:00:00Z',
    });
    expect(s).toMatchObject({ deniedDate: '2026-09-05T12:00:00Z', arcResult: 'Denied', boardResult: 'Not reached' });
  });

  it('v2 in Board review shows ARC approved and Board pending', () => {
    const s = getArbDecisionSummary({ ...base, status: 'BOARD_REVIEW', workflow_version: 2, current_stage: 'BOARD_REVIEW' });
    expect(s).toMatchObject({ arcResult: 'Approved', boardResult: 'Pending', approvedDate: null });
  });

  it('flags deadline auto-approval', () => {
    const s = getArbDecisionSummary({
      ...base,
      status: 'BOARD_APPROVED',
      workflow_version: 2,
      current_stage: 'BOARD_APPROVED',
      resolved_at: '2026-09-20T12:00:00Z',
      auto_approved_reason: 'deadline_expired',
    });
    expect(s.autoApproved).toBe(true);
  });

  it('v1 decisions use esign_timestamp and have no Board stage', () => {
    const s = getArbDecisionSummary({ ...base, status: 'rejected', esign_timestamp: '2026-09-04T12:00:00Z' });
    expect(s).toMatchObject({
      receivedDate: '2026-09-01T12:00:00Z',
      deniedDate: '2026-09-04T12:00:00Z',
      arcResult: 'Denied',
      boardResult: null,
    });
  });

  it('v1 drafts have not been received', () => {
    expect(getArbDecisionSummary({ ...base, status: 'draft' }).receivedDate).toBeNull();
  });
});
