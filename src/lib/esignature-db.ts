/**
 * Electronic Signature Database Helpers
 * ESIGN Act compliant signature capture and verification
 */

export interface ElectronicSignature {
  id: string;
  document_type: string;
  document_id: string;
  signer_email: string;
  signer_name: string;
  signature_data: string; // JSON
  ip_address: string | null;
  user_agent: string | null;
  signed_at: string;
  consent_acknowledged: number;
  signature_valid: number;
  verification_code: string | null;
  created_at: string;
}

export interface SignatureData {
  typedName: string;
  consentGiven: boolean;
  intentStatement: string;
}

export interface CreateSignatureParams {
  documentType: string;
  documentId: string;
  signerEmail: string;
  signerName: string;
  signatureData: SignatureData;
  ipAddress?: string;
  userAgent?: string;
}

/** Generate unique signature ID */
function generateSignatureId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `esig_${timestamp}${random}`;
}

/** Generate verification code for audit */
function generateVerificationCode(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new electronic signature record
 */
export async function createElectronicSignature(
  db: D1Database,
  params: CreateSignatureParams
): Promise<string> {
  const id = generateSignatureId();
  const now = new Date().toISOString();
  const verificationCode = generateVerificationCode();

  await db
    .prepare(
      `INSERT INTO electronic_signatures
       (id, document_type, document_id, signer_email, signer_name,
        signature_data, ip_address, user_agent, signed_at,
        consent_acknowledged, signature_valid, verification_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`
    )
    .bind(
      id,
      params.documentType,
      params.documentId,
      params.signerEmail.toLowerCase(),
      params.signerName,
      JSON.stringify(params.signatureData),
      params.ipAddress ?? null,
      params.userAgent ?? null,
      now,
      verificationCode,
      now
    )
    .run();

  // Log audit event
  await logSignatureAudit(db, {
    signatureId: id,
    eventType: 'CREATED',
    actorEmail: params.signerEmail,
    ipAddress: params.ipAddress,
    details: { documentType: params.documentType, documentId: params.documentId },
  });

  // Track analytics
  try {
    const { trackSignatureEvent } = await import('./analytics');
    await trackSignatureEvent(db, {
      eventType: 'created',
      signatureId: id,
      documentType: params.documentType,
      documentId: params.documentId,
      userEmail: params.signerEmail,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  } catch (e) {
    // Analytics failure shouldn't break signature creation
    console.warn('Failed to track signature analytics:', e);
  }

  return id;
}

/**
 * Get signature by ID
 */
export async function getElectronicSignature(
  db: D1Database,
  signatureId: string
): Promise<ElectronicSignature | null> {
  return db
    .prepare(
      `SELECT id, document_type, document_id, signer_email, signer_name,
              signature_data, ip_address, user_agent, signed_at,
              consent_acknowledged, signature_valid, verification_code, created_at
       FROM electronic_signatures
       WHERE id = ?
       LIMIT 1`
    )
    .bind(signatureId)
    .first<ElectronicSignature>();
}

/**
 * Batch load electronic signatures by IDs (optimized to prevent N+1 queries)
 */
export async function batchLoadElectronicSignatures(
  db: D1Database,
  signatureIds: string[]
): Promise<Record<string, ElectronicSignature>> {
  if (signatureIds.length === 0) return {};

  // Remove duplicates and filter out null/undefined
  const uniqueIds = Array.from(new Set(signatureIds.filter(Boolean)));

  if (uniqueIds.length === 0) return {};

  // SQLite has a limit on the number of parameters (999), so batch in chunks
  const BATCH_SIZE = 500;
  const result: Record<string, ElectronicSignature> = {};

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => '?').join(',');

    const { results } = await db
      .prepare(
        `SELECT id, document_type, document_id, signer_email, signer_name,
                signature_data, ip_address, user_agent, signed_at,
                consent_acknowledged, signature_valid, verification_code, created_at
         FROM electronic_signatures
         WHERE id IN (${placeholders})`
      )
      .bind(...batch)
      .all<ElectronicSignature>();

    for (const signature of results ?? []) {
      result[signature.id] = signature;
    }
  }

  return result;
}

/**
 * Get signatures for a specific document
 */
export async function getSignaturesForDocument(
  db: D1Database,
  documentType: string,
  documentId: string
): Promise<ElectronicSignature[]> {
  const { results } = await db
    .prepare(
      `SELECT id, document_type, document_id, signer_email, signer_name,
              signature_data, ip_address, user_agent, signed_at,
              consent_acknowledged, signature_valid, verification_code, created_at
       FROM electronic_signatures
       WHERE document_type = ? AND document_id = ?
       ORDER BY signed_at DESC`
    )
    .bind(documentType, documentId)
    .all<ElectronicSignature>();

  return results ?? [];
}

/**
 * Verify signature is valid
 */
export async function verifySignature(
  db: D1Database,
  signatureId: string
): Promise<boolean> {
  const sig = await getElectronicSignature(db, signatureId);
  if (!sig) return false;

  // Check signature is still marked as valid
  if (sig.signature_valid !== 1) return false;

  // Check consent was acknowledged
  if (sig.consent_acknowledged !== 1) return false;

  // Parse signature data
  try {
    const data = JSON.parse(sig.signature_data) as SignatureData;
    if (!data.consentGiven || !data.typedName || !data.intentStatement) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * Revoke a signature (invalidate it)
 */
export async function revokeSignature(
  db: D1Database,
  signatureId: string,
  revokedBy: string,
  reason?: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE electronic_signatures
       SET signature_valid = 0
       WHERE id = ?`
    )
    .bind(signatureId)
    .run();

  // Log audit event
  await logSignatureAudit(db, {
    signatureId,
    eventType: 'REVOKED',
    actorEmail: revokedBy,
    details: { reason },
  });

  // Track analytics
  try {
    const sig = await getElectronicSignature(db, signatureId);
    if (sig) {
      const { trackSignatureEvent } = await import('./analytics');
      await trackSignatureEvent(db, {
        eventType: 'revoked',
        signatureId,
        documentType: sig.document_type,
        documentId: sig.document_id,
        actorEmail: revokedBy,
      });
    }
  } catch (e) {
    console.warn('Failed to track signature revocation analytics:', e);
  }
}

/**
 * Parse signature data JSON
 */
export function parseSignatureData(signature: ElectronicSignature): SignatureData | null {
  try {
    return JSON.parse(signature.signature_data) as SignatureData;
  } catch {
    return null;
  }
}

// ========== AUDIT LOGGING ==========

interface LogSignatureAuditParams {
  signatureId: string;
  eventType: 'CREATED' | 'VERIFIED' | 'REVOKED' | 'VIEWED';
  actorEmail?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
}

/**
 * Log signature audit event
 */
export async function logSignatureAudit(
  db: D1Database,
  params: LogSignatureAuditParams
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO esignature_audit_log
       (signature_id, event_type, actor_email, ip_address, details, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      params.signatureId,
      params.eventType,
      params.actorEmail ?? null,
      params.ipAddress ?? null,
      params.details ? JSON.stringify(params.details) : null
    )
    .run();
}

/**
 * Get audit log for a signature
 */
export async function getSignatureAuditLog(
  db: D1Database,
  signatureId: string
): Promise<Array<{
  id: number;
  signature_id: string;
  event_type: string;
  actor_email: string | null;
  ip_address: string | null;
  details: string | null;
  created_at: string;
}>> {
  const { results } = await db
    .prepare(
      `SELECT id, signature_id, event_type, actor_email, ip_address, details, created_at
       FROM esignature_audit_log
       WHERE signature_id = ?
       ORDER BY created_at DESC`
    )
    .bind(signatureId)
    .all<{
      id: number;
      signature_id: string;
      event_type: string;
      actor_email: string | null;
      ip_address: string | null;
      details: string | null;
      created_at: string;
    }>();

  return results ?? [];
}
