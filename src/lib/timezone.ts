/**
 * Timezone utilities for displaying timestamps in Eastern Time (America/New_York).
 *
 * All timestamps in the database are stored in UTC (correct).
 * This module provides formatting functions to display them in Eastern Time for Florida users.
 * America/New_York automatically handles EST/EDT transitions.
 */

/**
 * Format a date/time in Eastern Time with full date and time.
 * Example: "Feb 17, 2026, 2:30 PM EST"
 */
export function formatEasternDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;

    // Format date and time
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);

    // Get timezone abbreviation (EST or EDT)
    const tzAbbr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    }).formatToParts(d).find(part => part.type === 'timeZoneName')?.value || 'ET';

    return `${formatted} ${tzAbbr}`;
  } catch {
    return String(date);
  }
}

/**
 * Format just the date in Eastern Time.
 * Example: "Feb 17, 2026"
 */
export function formatEasternDate(date: Date | string | null | undefined): string {
  if (!date) return '—';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return String(date);
  }
}

/**
 * Format just the time in Eastern Time.
 * Example: "2:30 PM EST"
 */
export function formatEasternTime(date: Date | string | null | undefined): string {
  if (!date) return '—';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;

    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);

    // Get timezone abbreviation (EST or EDT)
    const tzAbbr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    }).formatToParts(d).find(part => part.type === 'timeZoneName')?.value || 'ET';

    return `${timeStr} ${tzAbbr}`;
  } catch {
    return String(date);
  }
}

/**
 * Format a date/time with long format.
 * Example: "Monday, February 17, 2026 at 2:30 PM EST"
 */
export function formatEasternDateTimeLong(date: Date | string | null | undefined): string {
  if (!date) return '—';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;

    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);

    // Get timezone abbreviation (EST or EDT)
    const tzAbbr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    }).formatToParts(d).find(part => part.type === 'timeZoneName')?.value || 'ET';

    return `${formatted} ${tzAbbr}`;
  } catch {
    return String(date);
  }
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * For recent timestamps (< 7 days)
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '—';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (Math.abs(diffSec) < 60) return 'just now';
    if (Math.abs(diffMin) < 60) return `${Math.abs(diffMin)} minute${Math.abs(diffMin) === 1 ? '' : 's'} ago`;
    if (Math.abs(diffHour) < 24) return `${Math.abs(diffHour)} hour${Math.abs(diffHour) === 1 ? '' : 's'} ago`;
    if (Math.abs(diffDay) < 7) return `${Math.abs(diffDay)} day${Math.abs(diffDay) === 1 ? '' : 's'} ago`;

    // For older dates, show formatted date
    return formatEasternDate(d);
  } catch {
    return String(date);
  }
}

/**
 * Convert UTC cron hour to Eastern Time display string.
 * Example: cronHourToEastern(2) = "9:00 PM EST / 10:00 PM EDT"
 */
export function cronHourToEastern(utcHour: number): string {
  // Create two dates: one in winter (EST) and one in summer (EDT)
  const winterDate = new Date(Date.UTC(2026, 0, 15, utcHour, 0, 0)); // January (EST)
  const summerDate = new Date(Date.UTC(2026, 6, 15, utcHour, 0, 0)); // July (EDT)

  const estTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(winterDate);

  const edtTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(summerDate);

  return `${estTime} EST / ${edtTime} EDT`;
}
