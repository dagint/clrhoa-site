/**
 * Password Strength Checking Utility
 *
 * Provides client-side password strength validation and visual feedback.
 * Used across all password input forms (login, setup, reset, change).
 *
 * Strength Levels:
 * - Weak: < 8 characters or very simple
 * - Fair: 8+ characters with basic variety
 * - Good: 10+ characters with good variety (uppercase, lowercase, numbers)
 * - Strong: 12+ characters with excellent variety (all types including symbols)
 *
 * Usage:
 * ```typescript
 * import { checkPasswordStrength } from './password-strength';
 *
 * const result = checkPasswordStrength('MyP@ssw0rd123');
 * console.log(result.level); // 'strong'
 * console.log(result.score); // 4
 * console.log(result.feedback); // 'Strong password!'
 * ```
 */

export interface PasswordStrengthResult {
  score: number; // 0-4
  level: 'weak' | 'fair' | 'good' | 'strong';
  color: string; // CSS color for progress bar
  percentage: number; // 0-100 for progress bar width
  feedback: string; // User-friendly message
}

/**
 * Check password strength and return detailed result.
 *
 * @param password - Password to check
 * @returns PasswordStrengthResult with score, level, color, percentage, and feedback
 */
export function checkPasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      score: 0,
      level: 'weak',
      color: '#ef4444', // red-500
      percentage: 0,
      feedback: 'Enter a password',
    };
  }

  let score = 0;
  const length = password.length;

  // Length scoring
  if (length >= 8) score += 1;
  if (length >= 10) score += 1;
  if (length >= 12) score += 1;

  // Character variety scoring
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSymbols = /[^a-zA-Z0-9]/.test(password);

  const varietyCount = [hasLowercase, hasUppercase, hasNumbers, hasSymbols].filter(Boolean).length;

  if (varietyCount >= 2) score += 1;
  if (varietyCount >= 3) score += 1;
  if (varietyCount === 4) score += 1;

  // Penalize common patterns
  const commonPatterns = [
    /^[0-9]+$/, // Only numbers
    /^[a-z]+$/, // Only lowercase
    /^[A-Z]+$/, // Only uppercase
    /^(.)\1+$/, // Repeated characters (aaa, 111)
    /password/i,
    /qwerty/i,
    /123456/,
    /abc123/i,
  ];

  const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password));
  if (hasCommonPattern && score > 1) {
    score -= 1;
  }

  // Map score to level
  let level: 'weak' | 'fair' | 'good' | 'strong';
  let color: string;
  let feedback: string;

  if (score <= 2) {
    level = 'weak';
    color = '#ef4444'; // red-500
    feedback = 'Weak - Add more characters and variety';
  } else if (score === 3) {
    level = 'fair';
    color = '#f59e0b'; // amber-500
    feedback = 'Fair - Could be stronger';
  } else if (score === 4) {
    level = 'good';
    color = '#3b82f6'; // blue-500
    feedback = 'Good password!';
  } else {
    level = 'strong';
    color = '#10b981'; // green-500
    feedback = 'Strong password!';
  }

  // Calculate percentage (0-100)
  const percentage = Math.min(100, (score / 5) * 100);

  return {
    score,
    level,
    color,
    percentage,
    feedback,
  };
}

/**
 * Generate password strength indicator HTML.
 * Can be injected into the DOM where needed.
 *
 * @param containerId - ID of container element
 * @returns HTML string for strength indicator
 */
export function getPasswordStrengthHTML(containerId: string = 'password-strength'): string {
  return `
    <div id="${containerId}" class="hidden mt-2">
      <div class="flex items-center justify-between mb-1">
        <span id="${containerId}-label" class="text-xs font-medium text-gray-600">Password strength</span>
        <span id="${containerId}-feedback" class="text-xs text-gray-500"></span>
      </div>
      <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          id="${containerId}-bar"
          class="h-full transition-all duration-300 ease-in-out"
          style="width: 0%; background-color: #ef4444;"
        ></div>
      </div>
    </div>
  `;
}

/**
 * Update password strength indicator in the DOM.
 *
 * @param password - Current password value
 * @param containerId - ID of strength indicator container
 */
export function updatePasswordStrengthIndicator(password: string, containerId: string = 'password-strength'): void {
  const container = document.getElementById(containerId);
  const bar = document.getElementById(`${containerId}-bar`);
  const feedback = document.getElementById(`${containerId}-feedback`);

  if (!container || !bar || !feedback) return;

  if (!password) {
    container.classList.add('hidden');
    return;
  }

  const result = checkPasswordStrength(password);

  container.classList.remove('hidden');
  bar.style.width = `${result.percentage}%`;
  bar.style.backgroundColor = result.color;
  feedback.textContent = result.feedback;
}
