/**
 * Database helpers for board and ARB position management.
 * Tracks current and historical leadership positions.
 */

import { generateId } from '../utils/id-generator.js';
import { getOwnerByEmail } from './directory-db';

/**
 * Valid board and ARB titles
 */
export const BOARD_TITLES = {
  // Board positions (one person each except Member at Large)
  PRESIDENT: 'President',
  VICE_PRESIDENT: 'Vice President',
  SECRETARY: 'Secretary',
  TREASURER: 'Treasurer',
  MEMBER_AT_LARGE: 'Member at Large',

  // ARB positions
  ARB_CHAIR: 'ARB Chair',
  ARB_MEMBER: 'ARB Member',
} as const;

export type BoardTitle = typeof BOARD_TITLES[keyof typeof BOARD_TITLES];

/**
 * Positions that can only have one person at a time
 */
export const SINGULAR_POSITIONS: BoardTitle[] = [
  BOARD_TITLES.PRESIDENT,
  BOARD_TITLES.VICE_PRESIDENT,
  BOARD_TITLES.SECRETARY,
  BOARD_TITLES.TREASURER,
  BOARD_TITLES.ARB_CHAIR,
];

export interface BoardPosition {
  id: string;
  user_email: string;
  title: BoardTitle;
  start_date: string;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CurrentPosition {
  email: string;
  title: BoardTitle;
  name: string | null;
  start_date: string;
}

/**
 * Get all current board/ARB positions (end_date IS NULL)
 */
export async function getCurrentPositions(db: D1Database): Promise<CurrentPosition[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT bp.user_email as email, bp.title, bp.start_date, o.name
         FROM board_positions bp
         LEFT JOIN owners o ON bp.user_email = o.email
         WHERE bp.end_date IS NULL
         ORDER BY
           CASE bp.title
             WHEN 'President' THEN 1
             WHEN 'Vice President' THEN 2
             WHEN 'Secretary' THEN 3
             WHEN 'Treasurer' THEN 4
             WHEN 'Member at Large' THEN 5
             WHEN 'ARB Chair' THEN 6
             WHEN 'ARB Member' THEN 7
             ELSE 8
           END,
           o.name ASC`
      )
      .all<CurrentPosition>();
    return results ?? [];
  } catch (error) {
    console.error('[board-positions-db] Failed to get current positions:', error);
    return [];
  }
}

/**
 * Get current position for a specific user
 */
export async function getUserCurrentPosition(db: D1Database, email: string): Promise<BoardTitle | null> {
  try {
    const result = await db
      .prepare('SELECT title FROM board_positions WHERE user_email = ? AND end_date IS NULL LIMIT 1')
      .bind(email.trim().toLowerCase())
      .first<{ title: BoardTitle }>();
    return result?.title ?? null;
  } catch (error) {
    console.error('[board-positions-db] Failed to get user position:', error);
    return null;
  }
}

/**
 * Get who currently holds a specific title (for singular positions)
 */
export async function getPositionHolder(db: D1Database, title: BoardTitle): Promise<string | null> {
  try {
    const result = await db
      .prepare('SELECT user_email FROM board_positions WHERE title = ? AND end_date IS NULL LIMIT 1')
      .bind(title)
      .first<{ user_email: string }>();
    return result?.user_email ?? null;
  } catch (error) {
    console.error('[board-positions-db] Failed to get position holder:', error);
    return null;
  }
}

/**
 * Get position history for a user
 */
export async function getUserPositionHistory(db: D1Database, email: string): Promise<BoardPosition[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT * FROM board_positions
         WHERE user_email = ?
         ORDER BY start_date DESC`
      )
      .bind(email.trim().toLowerCase())
      .all<BoardPosition>();
    return results ?? [];
  } catch (error) {
    console.error('[board-positions-db] Failed to get position history:', error);
    return [];
  }
}

/**
 * Assign a board/ARB position to a user
 * - Creates history record with start_date
 * - Updates owners.board_title for directory display
 * - If singular position, ends previous holder's term
 */
export async function assignBoardPosition(
  db: D1Database,
  email: string,
  title: BoardTitle,
  assignedBy: string,
  startDate?: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const start = startDate ?? new Date().toISOString().slice(0, 10);

  try {
    // Validate user exists in owners
    const owner = await getOwnerByEmail(db, normalizedEmail);
    if (!owner) {
      return { success: false, error: 'User not found in directory' };
    }

    // Check if user already has a current position
    const currentPosition = await getUserCurrentPosition(db, normalizedEmail);
    if (currentPosition) {
      // If they're being assigned the SAME position, treat it as a no-op success
      if (currentPosition === title) {
        return { success: true };
      }
      // Otherwise, they need to have their current position removed first
      return { success: false, error: `User already holds position: ${currentPosition}. Remove it first before assigning a new position.` };
    }

    // For singular positions, end the current holder's term
    if (SINGULAR_POSITIONS.includes(title)) {
      const currentHolder = await getPositionHolder(db, title);
      if (currentHolder && currentHolder !== normalizedEmail) {
        await endBoardPosition(db, currentHolder, title);
      }
    }

    // Create new position record
    const id = generateId();
    await db
      .prepare(
        `INSERT INTO board_positions (id, user_email, title, start_date, created_by)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, normalizedEmail, title, start, assignedBy)
      .run();

    // Update owners.board_title for directory display (direct update to avoid fallback chain losing board_title)
    await db.prepare('UPDATE owners SET board_title = ? WHERE id = ?').bind(title, owner.id).run();

    return { success: true };
  } catch (error) {
    console.error('[board-positions-db] Failed to assign position:', error);
    return { success: false, error: 'Database error' };
  }
}

/**
 * End a board/ARB position for a user
 * - Sets end_date on history record
 * - Clears owners.board_title
 */
export async function endBoardPosition(
  db: D1Database,
  email: string,
  title?: BoardTitle,
  endDate?: string
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const end = endDate ?? new Date().toISOString().slice(0, 10);

  try {
    // Find owner record
    const owner = await getOwnerByEmail(db, normalizedEmail);
    if (!owner) return false;

    // End position in history
    if (title) {
      await db
        .prepare(
          `UPDATE board_positions
           SET end_date = ?, updated_at = datetime('now')
           WHERE user_email = ? AND title = ? AND end_date IS NULL`
        )
        .bind(end, normalizedEmail, title)
        .run();
    } else {
      // End all current positions for user
      await db
        .prepare(
          `UPDATE board_positions
           SET end_date = ?, updated_at = datetime('now')
           WHERE user_email = ? AND end_date IS NULL`
        )
        .bind(end, normalizedEmail)
        .run();
    }

    // Clear board_title in owners (direct update to avoid fallback chain losing board_title)
    await db.prepare('UPDATE owners SET board_title = NULL WHERE id = ?').bind(owner.id).run();

    return true;
  } catch (error) {
    console.error('[board-positions-db] Failed to end position:', error);
    return false;
  }
}

/**
 * Update a user's position (change title without ending/starting)
 * Useful for corrections or role changes
 */
export async function updateBoardPosition(
  db: D1Database,
  email: string,
  newTitle: BoardTitle,
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Get current position
    const currentTitle = await getUserCurrentPosition(db, normalizedEmail);
    if (!currentTitle) {
      return { success: false, error: 'User has no current position' };
    }

    // End current position and start new one
    const today = new Date().toISOString().slice(0, 10);
    await endBoardPosition(db, normalizedEmail, currentTitle, today);
    return await assignBoardPosition(db, normalizedEmail, newTitle, updatedBy, today);
  } catch (error) {
    console.error('[board-positions-db] Failed to update position:', error);
    return { success: false, error: 'Database error' };
  }
}

/**
 * Get all position history (for admin/board viewing)
 */
export async function getAllPositionHistory(
  db: D1Database,
  limit: number = 100
): Promise<BoardPosition[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT * FROM board_positions
         ORDER BY start_date DESC, end_date DESC
         LIMIT ?`
      )
      .bind(limit)
      .all<BoardPosition>();
    return results ?? [];
  } catch (error) {
    console.error('[board-positions-db] Failed to get all position history:', error);
    return [];
  }
}
