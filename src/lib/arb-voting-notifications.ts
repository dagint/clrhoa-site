/**
 * Email notification templates for ARB multi-stage voting workflow.
 *
 * All templates follow the same structure:
 * - Subject line
 * - HTML email body with consistent styling
 * - Links to the request
 */

const SITE_URL = 'https://clrhoa.com';
const SITE_NAME = 'Crooked Lake Reserve HOA';

// Common email styles
const EMAIL_STYLES = `
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
  .header { background-color: #2d5016; color: #ffffff; padding: 30px 20px; text-align: center; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
  .content { padding: 30px 20px; }
  .content h2 { color: #2d5016; font-size: 20px; margin-top: 0; }
  .content p { margin: 15px 0; }
  .badge { display: inline-block; padding: 6px 12px; border-radius: 4px; font-size: 14px; font-weight: 600; margin: 10px 0; }
  .badge-blue { background-color: #dbeafe; color: #1e40af; }
  .badge-green { background-color: #d1fae5; color: #065f46; }
  .badge-red { background-color: #fee2e2; color: #991b1b; }
  .badge-yellow { background-color: #fef3c7; color: #92400e; }
  .button { display: inline-block; padding: 12px 24px; background-color: #2d5016; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 15px 0; }
  .button:hover { background-color: #3a6a1c; }
  .info-box { background-color: #f3f4f6; border-left: 4px solid #2d5016; padding: 15px; margin: 15px 0; }
  .footer { background-color: #f9fafb; color: #6b7280; padding: 20px; text-align: center; font-size: 12px; }
  .footer a { color: #2d5016; text-decoration: none; }
  .vote-counts { display: flex; justify-content: space-around; margin: 20px 0; }
  .vote-count { text-align: center; }
  .vote-count-number { font-size: 32px; font-weight: bold; }
  .vote-count-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
</style>
`;

/**
 * Generate email subject and HTML body for a notification.
 */
interface EmailTemplate {
  subject: string;
  html: string;
}

/**
 * Request submitted - notify ARC members
 */
export function getRequestSubmittedEmail(
  requestId: string,
  ownerEmail: string,
  description: string
): EmailTemplate {
  return {
    subject: `New ARB Request Submitted: ${requestId}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${SITE_NAME}</h1>
    </div>
    <div class="content">
      <h2>New ARB Request Submitted</h2>
      <p>A new architectural review request has been submitted and is ready for ARC review.</p>

      <div class="info-box">
        <p><strong>Request ID:</strong> ${requestId}</p>
        <p><strong>Submitted by:</strong> ${ownerEmail}</p>
        <p><strong>Description:</strong> ${description}</p>
      </div>

      <p>An ARC member needs to begin the review process to start voting.</p>

      <a href="${SITE_URL}/portal/arb-dashboard" class="button">View Request</a>
    </div>
    <div class="footer">
      <p>${SITE_NAME} | <a href="${SITE_URL}">clrhoa.com</a></p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

/**
 * ARC review started - notify request owner
 */
export function getArcReviewStartedEmail(
  requestId: string,
  ownerName: string
): EmailTemplate {
  return {
    subject: `ARC Review Started: ${requestId}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${SITE_NAME}</h1>
    </div>
    <div class="content">
      <h2>ARC Review Started</h2>
      <p>Dear ${ownerName},</p>

      <p>Your architectural review request <strong>${requestId}</strong> is now under review by the Architecture Review Committee (ARC).</p>

      <div class="info-box">
        <p><strong>What happens next:</strong></p>
        <ul>
          <li>ARC members will review your request and cast their votes</li>
          <li>A majority vote is needed to approve, deny, or return for more information</li>
          <li>You will be notified when the ARC reaches a decision</li>
          <li>If approved by ARC, your request will advance to Board review</li>
        </ul>
      </div>

      <p><strong>Review deadline:</strong> Per Florida statute, a decision will be made within 30 days or your request will be automatically approved.</p>

      <a href="${SITE_URL}/portal/arb-dashboard" class="button">View Request Status</a>
    </div>
    <div class="footer">
      <p>${SITE_NAME} | <a href="${SITE_URL}">clrhoa.com</a></p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

/**
 * Vote cast - notify other reviewers (debounced)
 */
export function getVoteCastEmail(
  requestId: string,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW',
  votesCast: number,
  totalEligible: number,
  majorityNeeded: number
): EmailTemplate {
  const stageLabel = stage === 'ARC_REVIEW' ? 'ARC' : 'Board';

  return {
    subject: `Vote Cast on ${requestId} (${votesCast}/${totalEligible})`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${SITE_NAME}</h1>
    </div>
    <div class="content">
      <h2>${stageLabel} Vote Progress</h2>
      <p>A vote has been cast on ARB request <strong>${requestId}</strong>.</p>

      <div class="info-box">
        <p style="font-size: 18px; margin: 10px 0;"><strong>${votesCast} of ${totalEligible}</strong> votes cast</p>
        <p><strong>${majorityNeeded}</strong> votes needed for majority</p>
      </div>

      <p>If you haven't voted yet, please review the request and cast your vote.</p>

      <a href="${SITE_URL}/portal/arb-dashboard" class="button">Cast Your Vote</a>
    </div>
    <div class="footer">
      <p>${SITE_NAME} | <a href="${SITE_URL}">clrhoa.com</a></p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

/**
 * ARC decision reached - notify owner and board
 */
export function getArcDecisionEmail(
  requestId: string,
  ownerName: string,
  decision: 'APPROVED' | 'DENIED' | 'RETURNED',
  approveCount: number,
  denyCount: number,
  returnCount: number,
  comment?: string
): EmailTemplate {
  let subject = '';
  let decisionText = '';
  let nextSteps = '';
  let badgeClass = '';

  if (decision === 'APPROVED') {
    subject = `ARC Approved: ${requestId}`;
    decisionText = 'The ARC has approved your request!';
    nextSteps = '<p><strong>Next step:</strong> Your request will now be reviewed by the Board for final approval.</p>';
    badgeClass = 'badge-green';
  } else if (decision === 'DENIED') {
    subject = `ARC Denied: ${requestId}`;
    decisionText = 'The ARC has denied your request.';
    nextSteps = '<p>If you believe this decision was made in error or have additional information, you may appeal to the Board.</p>';
    badgeClass = 'badge-red';
  } else {
    subject = `ARC Returned: ${requestId}`;
    decisionText = 'The ARC has returned your request for additional information.';
    nextSteps = '<p><strong>Next step:</strong> Please review the feedback below, make any necessary updates to your request, and resubmit.</p>';
    badgeClass = 'badge-yellow';
  }

  return {
    subject,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${SITE_NAME}</h1>
    </div>
    <div class="content">
      <h2>ARC Decision</h2>
      <p>Dear ${ownerName},</p>

      <p>${decisionText}</p>

      <span class="badge ${badgeClass}">Request ${requestId}: ${decision}</span>

      <div class="vote-counts">
        <div class="vote-count">
          <div class="vote-count-number" style="color: #059669;">${approveCount}</div>
          <div class="vote-count-label">Approve</div>
        </div>
        <div class="vote-count">
          <div class="vote-count-number" style="color: #dc2626;">${denyCount}</div>
          <div class="vote-count-label">Deny</div>
        </div>
        <div class="vote-count">
          <div class="vote-count-number" style="color: #d97706;">${returnCount}</div>
          <div class="vote-count-label">Return</div>
        </div>
      </div>

      ${comment ? `<div class="info-box"><p><strong>Reviewer feedback:</strong></p><p>${comment}</p></div>` : ''}

      ${nextSteps}

      <a href="${SITE_URL}/portal/arb-dashboard" class="button">View Request</a>
    </div>
    <div class="footer">
      <p>${SITE_NAME} | <a href="${SITE_URL}">clrhoa.com</a></p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

/**
 * Board review started - notify owner and board members
 */
export function getBoardReviewStartedEmail(
  requestId: string,
  recipientName: string,
  isOwner: boolean
): EmailTemplate {
  return {
    subject: `Board Review Started: ${requestId}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${SITE_NAME}</h1>
    </div>
    <div class="content">
      <h2>Board Review Started</h2>
      <p>Dear ${recipientName},</p>

      ${isOwner
        ? `<p>Your architectural review request <strong>${requestId}</strong> has been approved by the ARC and is now under Board review for final approval.</p>`
        : `<p>ARB request <strong>${requestId}</strong> has been approved by the ARC and is now ready for Board review.</p>`
      }

      <div class="info-box">
        <p><strong>What happens next:</strong></p>
        <ul>
          <li>Board members will review the request and cast their votes</li>
          <li>A majority vote is needed for final approval</li>
          ${isOwner ? '<li>You will be notified when the Board reaches a decision</li>' : '<li>Please cast your vote as a Board member</li>'}
        </ul>
      </div>

      <a href="${SITE_URL}/portal/arb-dashboard" class="button">${isOwner ? 'View Request Status' : 'Cast Your Vote'}</a>
    </div>
    <div class="footer">
      <p>${SITE_NAME} | <a href="${SITE_URL}">clrhoa.com</a></p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

/**
 * Board decision - notify owner
 */
export function getBoardDecisionEmail(
  requestId: string,
  ownerName: string,
  decision: 'APPROVED' | 'DENIED' | 'RETURNED',
  approveCount: number,
  denyCount: number,
  returnCount: number,
  comment?: string
): EmailTemplate {
  let subject = '';
  let decisionText = '';
  let nextSteps = '';
  let badgeClass = '';

  if (decision === 'APPROVED') {
    subject = `🎉 Request Approved: ${requestId}`;
    decisionText = 'Congratulations! The Board has given final approval to your architectural review request.';
    nextSteps = '<p><strong>You may now proceed with your project as described in your request.</strong></p><p>Please ensure all work complies with the approved plans and HOA guidelines.</p>';
    badgeClass = 'badge-green';
  } else if (decision === 'DENIED') {
    subject = `Request Denied: ${requestId}`;
    decisionText = 'The Board has denied your request after review.';
    nextSteps = '<p>If you believe this decision was made in error or have additional information, please contact the Board.</p>';
    badgeClass = 'badge-red';
  } else {
    subject = `Request Returned: ${requestId}`;
    decisionText = 'The Board has returned your request for additional information.';
    nextSteps = '<p><strong>Next step:</strong> Please review the feedback below, make any necessary updates, and resubmit. Your request will go through ARC review again before returning to the Board.</p>';
    badgeClass = 'badge-yellow';
  }

  return {
    subject,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${SITE_NAME}</h1>
    </div>
    <div class="content">
      <h2>Board Decision</h2>
      <p>Dear ${ownerName},</p>

      <p>${decisionText}</p>

      <span class="badge ${badgeClass}">Request ${requestId}: ${decision}</span>

      <div class="vote-counts">
        <div class="vote-count">
          <div class="vote-count-number" style="color: #059669;">${approveCount}</div>
          <div class="vote-count-label">Approve</div>
        </div>
        <div class="vote-count">
          <div class="vote-count-number" style="color: #dc2626;">${denyCount}</div>
          <div class="vote-count-label">Deny</div>
        </div>
        <div class="vote-count">
          <div class="vote-count-number" style="color: #d97706;">${returnCount}</div>
          <div class="vote-count-label">Return</div>
        </div>
      </div>

      ${comment ? `<div class="info-box"><p><strong>Board feedback:</strong></p><p>${comment}</p></div>` : ''}

      ${nextSteps}

      <a href="${SITE_URL}/portal/arb-dashboard" class="button">View Request</a>
    </div>
    <div class="footer">
      <p>${SITE_NAME} | <a href="${SITE_URL}">clrhoa.com</a></p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

/**
 * Deadline warning (7 or 3 days)
 */
export function getDeadlineWarningEmail(
  requestId: string,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW',
  daysRemaining: number,
  deadlineDate: string
): EmailTemplate {
  const stageLabel = stage === 'ARC_REVIEW' ? 'ARC' : 'Board';

  return {
    subject: `⚠️ Deadline Warning: ${requestId} (${daysRemaining} days remaining)`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${SITE_NAME}</h1>
    </div>
    <div class="content">
      <h2>⚠️ Review Deadline Approaching</h2>
      <p>ARB request <strong>${requestId}</strong> is approaching its 30-day review deadline.</p>

      <div class="info-box" style="border-left-color: #dc2626;">
        <p style="font-size: 18px; margin: 10px 0; color: #dc2626;"><strong>${daysRemaining} days remaining</strong></p>
        <p><strong>Deadline:</strong> ${new Date(deadlineDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <p><strong>Per Florida Statute 720.3035:</strong> If the ${stageLabel} does not reach a decision by the deadline, the request will be automatically approved.</p>

      <p>Please cast your vote as soon as possible to avoid automatic approval.</p>

      <a href="${SITE_URL}/portal/arb-dashboard" class="button">Cast Your Vote Now</a>
    </div>
    <div class="footer">
      <p>${SITE_NAME} | <a href="${SITE_URL}">clrhoa.com</a></p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

/**
 * Auto-approved due to deadline expiration
 */
export function getAutoApprovedEmail(
  requestId: string,
  ownerName: string,
  stage: 'ARC_REVIEW' | 'BOARD_REVIEW'
): EmailTemplate {
  const stageLabel = stage === 'ARC_REVIEW' ? 'ARC' : 'Board';

  return {
    subject: `Auto-Approved: ${requestId}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${SITE_NAME}</h1>
    </div>
    <div class="content">
      <h2>Request Auto-Approved</h2>
      <p>Dear ${ownerName},</p>

      <p>Your architectural review request <strong>${requestId}</strong> has been automatically approved because the 30-day review deadline has expired.</p>

      <span class="badge badge-green">AUTO-APPROVED</span>

      <div class="info-box">
        <p><strong>Per Florida Statute 720.3035:</strong> When the ${stageLabel} does not reach a decision within 30 days of submission, the request is automatically approved.</p>
      </div>

      ${stage === 'ARC_REVIEW'
        ? '<p><strong>Next step:</strong> Your request will now proceed to Board review for final approval.</p>'
        : '<p><strong>You may now proceed with your project as described in your request.</strong></p>'
      }

      <a href="${SITE_URL}/portal/arb-dashboard" class="button">View Request</a>
    </div>
    <div class="footer">
      <p>${SITE_NAME} | <a href="${SITE_URL}">clrhoa.com</a></p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}
