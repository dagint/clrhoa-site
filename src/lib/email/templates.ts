/**
 * Email Template Utilities
 *
 * Shared email layout and styling for consistent branding across all
 * transactional emails sent from the CLRHOA portal.
 *
 * Brand colors:
 * - Primary green: #1e5f38 (CLRHOA brand)
 * - Light green: #2d7a50
 * - Background: #f9fafb
 * - Text: #111827
 *
 * Usage:
 * ```typescript
 * import { createEmailTemplate } from './templates';
 *
 * const { html, text } = createEmailTemplate({
 *   title: 'Welcome',
 *   preheader: 'Set up your account',
 *   heading: 'Welcome to CLRHOA',
 *   content: '<p>Your account is ready!</p>',
 *   ctaText: 'Get Started',
 *   ctaUrl: 'https://...',
 *   footerText: 'Questions? Contact support@clrhoa.com'
 * });
 * ```
 */

import { escapeHtml } from '../sanitize';

/**
 * CLRHOA brand colors
 */
const COLORS = {
  // Brand greens (from login page and site)
  primaryGreen: '#1e5f38',
  lightGreen: '#2d7a50',
  darkGreen: '#16492b',

  // Neutral grays
  background: '#f9fafb',
  cardBg: '#ffffff',
  border: '#e5e7eb',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',

  // Semantic colors
  warning: '#ffc107',
  warningBg: '#fff3cd',
  warningText: '#856404',
  danger: '#dc3545',
  dangerBg: '#f8d7da',
  dangerText: '#721c24',
  info: '#17a2b8',
  infoBg: '#d1ecf1',
  infoText: '#0c5460',
};

/**
 * Email template options
 */
export interface EmailTemplateOptions {
  /** Page title (for <title> tag) */
  title: string;

  /** Preheader text (shows in inbox preview) */
  preheader?: string;

  /** Main heading text */
  heading: string;

  /** HTML content body */
  content: string;

  /** Primary CTA button text (optional) */
  ctaText?: string;

  /** Primary CTA button URL (optional) */
  ctaUrl?: string;

  /** Secondary CTA text (optional) */
  secondaryCtaText?: string;

  /** Secondary CTA URL (optional) */
  secondaryCtaUrl?: string;

  /** Warning/info box content (optional) */
  alertContent?: string;

  /** Alert type: 'warning' | 'danger' | 'info' */
  alertType?: 'warning' | 'danger' | 'info';

  /** Footer help text (optional) */
  footerText?: string;

  /** Plain text version (if not provided, will be auto-generated) */
  plainText?: string;
}

/**
 * Generate email header HTML with CLRHOA branding
 */
function generateHeader(heading: string): string {
  return `
  <!-- Header with CLRHOA branding -->
  <div style="background: linear-gradient(135deg, ${COLORS.primaryGreen} 0%, ${COLORS.darkGreen} 100%); padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <!-- Logo text (replace with <img> if logo file added) -->
    <div style="color: white; font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 700; margin-bottom: 10px; letter-spacing: 0.5px;">
      CROOKED LAKE RESERVE
    </div>
    <div style="color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500; letter-spacing: 1px; margin-bottom: 20px;">
      HOMEOWNERS ASSOCIATION
    </div>
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600; line-height: 1.3;">
      ${heading}
    </h1>
  </div>
  `;
}

/**
 * Generate CTA button HTML
 */
function generateButton(text: string, url: string, secondary: boolean = false): string {
  const bgColor = secondary ? COLORS.textSecondary : COLORS.primaryGreen;
  const hoverBg = secondary ? COLORS.textPrimary : COLORS.lightGreen;

  return `
  <div style="text-align: center; margin: 30px 0;">
    <a href="${url}"
       style="display: inline-block;
              background: ${bgColor};
              color: white;
              padding: 16px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              transition: background 0.2s;">
      ${text}
    </a>
  </div>
  <p style="font-size: 13px; color: ${COLORS.textSecondary}; text-align: center; margin-top: 15px;">
    If the button doesn't work, copy and paste this link into your browser:
  </p>
  <p style="font-size: 12px;
             color: ${COLORS.primaryGreen};
             word-break: break-all;
             background: ${COLORS.background};
             padding: 12px;
             border-radius: 6px;
             border: 1px solid ${COLORS.border};
             font-family: monospace;">
    ${url}
  </p>
  `;
}

/**
 * Generate alert/info box HTML
 */
function generateAlert(content: string, type: 'warning' | 'danger' | 'info'): string {
  const styles = {
    warning: {
      bg: COLORS.warningBg,
      border: COLORS.warning,
      text: COLORS.warningText,
      icon: '⏰',
    },
    danger: {
      bg: COLORS.dangerBg,
      border: COLORS.danger,
      text: COLORS.dangerText,
      icon: '⚠️',
    },
    info: {
      bg: COLORS.infoBg,
      border: COLORS.info,
      text: COLORS.infoText,
      icon: 'ℹ️',
    },
  };

  const style = styles[type];

  return `
  <div style="background: ${style.bg};
              border-left: 4px solid ${style.border};
              border-radius: 6px;
              padding: 16px 20px;
              margin: 25px 0;">
    <p style="margin: 0; font-size: 14px; color: ${style.text}; line-height: 1.6;">
      <span style="font-size: 18px; margin-right: 8px;">${style.icon}</span>
      ${content}
    </p>
  </div>
  `;
}

/**
 * Generate email footer HTML
 */
function generateFooter(footerText?: string): string {
  const currentYear = new Date().getFullYear();

  return `
  <hr style="border: none; border-top: 1px solid ${COLORS.border}; margin: 40px 0 30px 0;">

  ${footerText ? `
  <p style="font-size: 14px; color: ${COLORS.textSecondary}; margin-bottom: 20px; text-align: center;">
    ${footerText}
  </p>
  ` : ''}

  <p style="font-size: 13px; color: ${COLORS.textMuted}; text-align: center; margin-bottom: 10px;">
    Need help? Contact us at
    <a href="mailto:support@clrhoa.com" style="color: ${COLORS.primaryGreen}; text-decoration: none;">
      support@clrhoa.com
    </a>
  </p>

  <div style="text-align: center; padding: 20px 0 10px 0; color: ${COLORS.textMuted}; font-size: 12px; border-top: 1px solid ${COLORS.border}; margin-top: 30px;">
    <p style="margin: 0 0 5px 0;">
      &copy; ${currentYear} Crooked Lake Reserve Homeowners Association
    </p>
    <p style="margin: 0; font-size: 11px;">
      All rights reserved.
    </p>
  </div>
  `;
}

/**
 * Create a complete HTML email template with CLRHOA branding
 */
export function createEmailTemplate(options: EmailTemplateOptions): {
  html: string;
  text: string;
} {
  const {
    title,
    preheader,
    heading,
    content,
    ctaText,
    ctaUrl,
    secondaryCtaText,
    secondaryCtaUrl,
    alertContent,
    alertType = 'warning',
    footerText,
    plainText,
  } = options;

  // Build HTML body
  let bodyContent = content;

  // Add primary CTA if provided
  if (ctaText && ctaUrl) {
    bodyContent += generateButton(ctaText, ctaUrl, false);
  }

  // Add alert box if provided
  if (alertContent) {
    bodyContent += generateAlert(alertContent, alertType);
  }

  // Add secondary CTA if provided
  if (secondaryCtaText && secondaryCtaUrl) {
    bodyContent += generateButton(secondaryCtaText, secondaryCtaUrl, true);
  }

  // Complete HTML template
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
  ${preheader ? `
  <style>
    /* Hide preheader text in email body */
    .preheader { display: none !important; visibility: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; }
  </style>
  ` : ''}
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
             line-height: 1.6;
             color: ${COLORS.textPrimary};
             background-color: ${COLORS.background};
             margin: 0;
             padding: 0;
             -webkit-font-smoothing: antialiased;
             -moz-osx-font-smoothing: grayscale;">

  ${preheader ? `<div class="preheader">${escapeHtml(preheader)}</div>` : ''}

  <!-- Main container -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLORS.background};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Content card (max-width 600px for readability) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: ${COLORS.cardBg}; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07); overflow: hidden;">
          <tr>
            <td>
              ${generateHeader(heading)}

              <!-- Body content -->
              <div style="padding: 35px 30px;">
                ${bodyContent}
                ${generateFooter(footerText)}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // Generate plain text version if not provided
  const text = plainText || generatePlainText(options);

  return { html, text };
}

/**
 * Auto-generate plain text version from HTML content
 */
function generatePlainText(options: EmailTemplateOptions): string {
  const {
    heading,
    content,
    ctaText,
    ctaUrl,
    alertContent,
    footerText,
  } = options;

  // Strip HTML tags for plain text (basic implementation)
  const stripHtml = (html: string): string => {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  };

  let text = `
═══════════════════════════════════════
CROOKED LAKE RESERVE HOMEOWNERS ASSOCIATION
═══════════════════════════════════════

${heading.toUpperCase()}

${stripHtml(content)}
`;

  if (ctaText && ctaUrl) {
    text += `\n\n${ctaText}:\n${ctaUrl}`;
  }

  if (alertContent) {
    text += `\n\n⚠️ IMPORTANT:\n${stripHtml(alertContent)}`;
  }

  text += `\n\n${footerText || 'Need help? Contact us at support@clrhoa.com'}`;

  text += `\n\n───────────────────────────────────────`;
  text += `\n© ${new Date().getFullYear()} Crooked Lake Reserve Homeowners Association`;
  text += `\nAll rights reserved.`;

  return text.trim();
}

/**
 * Helper: Create a simple text paragraph with proper styling
 */
export function p(text: string, options?: { align?: 'left' | 'center' | 'right'; color?: string }): string {
  return `
  <p style="font-size: 16px;
             margin: 0 0 16px 0;
             color: ${options?.color || COLORS.textPrimary};
             text-align: ${options?.align || 'left'};
             line-height: 1.6;">
    ${text}
  </p>
  `;
}

/**
 * Helper: Create an unordered list with proper styling
 */
export function ul(items: string[]): string {
  return `
  <ul style="font-size: 15px;
              color: ${COLORS.textPrimary};
              margin: 16px 0;
              padding-left: 25px;
              line-height: 1.7;">
    ${items.map(item => `<li style="margin-bottom: 8px;">${item}</li>`).join('')}
  </ul>
  `;
}

/**
 * Helper: Create a section divider
 */
export function divider(): string {
  return `
  <hr style="border: none;
             border-top: 1px solid ${COLORS.border};
             margin: 30px 0;">
  `;
}
