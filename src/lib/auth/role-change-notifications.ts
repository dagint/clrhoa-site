/**
 * Role Change Notification Emails
 *
 * Utilities for sending professional email notifications when a user's role is changed.
 * Used by admin when updating user roles via the admin panel.
 *
 * Features:
 * - Professional HTML email template with branding
 * - Clear explanation of role change and what it means
 * - Lists new permissions and access levels
 * - Shows who made the change and when
 * - Includes support contact information
 *
 * Usage:
 * ```typescript
 * import { sendRoleChangeEmail } from './role-change-notifications';
 *
 * await sendRoleChangeEmail(
 *   resend,
 *   userEmail,
 *   userName,
 *   previousRole,
 *   newRole,
 *   changedByEmail
 * );
 * ```
 */

import { escapeHtml } from '../sanitize';
import type { ResendClient } from '../../types/resend';

/**
 * Role descriptions and permissions for email template
 */
const ROLE_DESCRIPTIONS: Record<string, { title: string; description: string; permissions: string[] }> = {
  member: {
    title: 'Member',
    description: 'Standard member access to the portal',
    permissions: [
      'View and download member documents',
      'Access member directory',
      'Submit ARB requests',
      'View meeting schedules',
      'Update your profile and settings',
    ],
  },
  arb: {
    title: 'ARB Committee',
    description: 'Architectural Review Board member access',
    permissions: [
      'All member permissions',
      'Review and approve ARB requests',
      'Access ARB dashboard and tools',
      'View ARB meeting minutes',
      'Manage pre-approval library',
    ],
  },
  board: {
    title: 'Board Member',
    description: 'Board member access with elevated permissions',
    permissions: [
      'All member permissions',
      'View financial reports and assessments',
      'Access board meeting minutes',
      'Manage vendors and contracts',
      'View site usage and analytics',
      'Access member directory with contact details',
    ],
  },
  arb_board: {
    title: 'ARB + Board Member',
    description: 'Combined ARB and Board member access',
    permissions: [
      'All member permissions',
      'All ARB permissions',
      'All Board permissions',
      'Full access to ARB and Board tools',
    ],
  },
  admin: {
    title: 'Administrator',
    description: 'Full administrative access to all portal features',
    permissions: [
      'All member, ARB, and Board permissions',
      'Manage user accounts and roles',
      'Configure site settings and permissions',
      'Access audit logs and security events',
      'Manage email notifications',
      'Full system administration',
    ],
  },
};

/**
 * Get role information for email template
 */
function getRoleInfo(role: string): { title: string; description: string; permissions: string[] } {
  return (
    ROLE_DESCRIPTIONS[role.toLowerCase()] || {
      title: role,
      description: 'Portal access',
      permissions: ['Standard portal access'],
    }
  );
}

/**
 * Send role change notification email using Resend.
 *
 * @param resend - Resend client instance
 * @param userEmail - User whose role was changed
 * @param userName - User's name for personalization
 * @param previousRole - Previous role (before change)
 * @param newRole - New role (after change)
 * @param changedBy - Email of admin who made the change
 * @param siteUrl - Base URL of the site
 */
export async function sendRoleChangeEmail(
  resend: ResendClient,
  userEmail: string,
  userName: string | null,
  previousRole: string,
  newRole: string,
  changedBy: string,
  siteUrl: string = 'https://www.clrhoa.com'
): Promise<void> {
  const previousRoleInfo = getRoleInfo(previousRole);
  const newRoleInfo = getRoleInfo(newRole);
  const portalUrl = `${siteUrl}/portal/dashboard`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your Account Role Has Been Updated</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Account Role Updated</h1>
  </div>

  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-top: 0;">
      ${userName ? `Hi ${escapeHtml(userName)},` : 'Hello,'}
    </p>

    <p style="font-size: 16px;">
      Your CLRHOA portal account role has been updated by an administrator.
    </p>

    <div style="background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Previous Role:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #374151;">${escapeHtml(previousRoleInfo.title)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">New Role:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #1e40af;">${escapeHtml(newRoleInfo.title)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Changed By:</td>
          <td style="padding: 8px 0; color: #374151;">${escapeHtml(changedBy)}</td>
        </tr>
      </table>
    </div>

    <div style="margin: 25px 0;">
      <h3 style="font-size: 18px; color: #1e40af; margin-bottom: 10px;">Your New Role: ${escapeHtml(newRoleInfo.title)}</h3>
      <p style="font-size: 14px; color: #6b7280; margin-bottom: 15px;">${escapeHtml(newRoleInfo.description)}</p>

      <p style="font-size: 14px; color: #374151; font-weight: 600; margin-bottom: 8px;">Your new permissions include:</p>
      <ul style="font-size: 14px; color: #4b5563; margin: 0; padding-left: 20px;">
        ${newRoleInfo.permissions.map(perm => `<li style="margin: 4px 0;">${escapeHtml(perm)}</li>`).join('')}
      </ul>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Visit Portal
      </a>
    </div>

    <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>📋 Note:</strong> It may take a few minutes for all permissions to take effect. If you experience any issues, try logging out and logging back in.
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="font-size: 14px; color: #6b7280;">
      If you have questions about this role change or need assistance with your new permissions, please contact:
    </p>
    <p style="font-size: 14px; margin: 5px 0;">
      <strong>Email:</strong> <a href="mailto:${escapeHtml(changedBy)}" style="color: #667eea; text-decoration: none;">${escapeHtml(changedBy)}</a><br>
      <strong>Support:</strong> <a href="mailto:support@clrhoa.com" style="color: #667eea; text-decoration: none;">support@clrhoa.com</a>
    </p>

    <p style="font-size: 12px; color: #999; margin-top: 20px;">
      This is an automated notification. If you believe this change was made in error, please contact support immediately.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p style="margin: 0;">
      &copy; ${new Date().getFullYear()} CLRHOA. All rights reserved.
    </p>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
Your Account Role Has Been Updated

${userName ? `Hi ${userName},` : 'Hello,'}

Your CLRHOA portal account role has been updated by an administrator.

ROLE CHANGE SUMMARY
-------------------
Previous Role: ${previousRoleInfo.title}
New Role: ${newRoleInfo.title}
Changed By: ${changedBy}

YOUR NEW ROLE: ${newRoleInfo.title.toUpperCase()}
${newRoleInfo.description}

Your new permissions include:
${newRoleInfo.permissions.map(perm => `• ${perm}`).join('\n')}

ACCESS YOUR ACCOUNT
Visit the portal: ${portalUrl}

📋 Note: It may take a few minutes for all permissions to take effect. If you experience any issues, try logging out and logging back in.

QUESTIONS OR CONCERNS?
If you have questions about this role change or need assistance with your new permissions, please contact:
- Email: ${changedBy}
- Support: support@clrhoa.com

This is an automated notification. If you believe this change was made in error, please contact support immediately.

© ${new Date().getFullYear()} CLRHOA. All rights reserved.
  `.trim();

  await resend.emails.send({
    from: 'CLRHOA Portal <portal@clrhoa.com>',
    to: userEmail,
    subject: `Your CLRHOA account role has been updated to ${newRoleInfo.title}`,
    html: htmlBody,
    text: textBody,
  });
}
