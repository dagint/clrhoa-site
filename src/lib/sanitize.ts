/**
 * Input sanitization utilities to prevent XSS attacks.
 * Uses DOMPurify-like approach but without external dependencies.
 */

/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}

/**
 * Sanitize text content for display (removes HTML tags, escapes special chars).
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  // Remove HTML tags and escape special characters
  return escapeHtml(text.replace(/<[^>]*>/g, ''));
}

/**
 * Sanitize user input for safe display in HTML context.
 * Use this for all user-generated content displayed in the UI.
 */
export function sanitizeForDisplay(text: string | null | undefined): string {
  return sanitizeText(text);
}

/**
 * Sanitize file name to prevent path traversal and XSS.
 */
export function sanitizeFileName(fileName: string | null | undefined): string {
  if (!fileName) return 'file';
  // Remove path separators and dangerous characters
  return fileName
    .replace(/[\/\\]/g, '_') // Replace path separators
    .replace(/[<>:"|?*]/g, '_') // Replace Windows forbidden chars
    .replace(/\.\./g, '_') // Prevent path traversal
    .replace(/^\./, '_') // Prevent hidden files
    .substring(0, 255); // Limit length
}

/**
 * Validate and sanitize email address format.
 */
export function sanitizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return null;
  return trimmed;
}

/**
 * Validate and sanitize phone number (basic format check).
 */
export function sanitizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove all non-digit characters except +, -, spaces, parentheses
  const cleaned = phone.replace(/[^\d+\-() ]/g, '');
  if (cleaned.length < 10) return null; // Minimum 10 digits
  return cleaned.trim();
}
