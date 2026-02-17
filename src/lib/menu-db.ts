/**
 * Database helpers for managing portal menu items.
 * Allows dynamic menu ordering and visibility without code changes.
 */

export interface MenuItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  position: number;
  visible: number;
  badge_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuItemUpdate {
  position?: number;
  visible?: number;
}

/**
 * Default menu items (fallback if database is empty)
 * Matches current PortalSidebar.astro order
 */
export const DEFAULT_MENU_ITEMS: Omit<MenuItem, 'created_at' | 'updated_at'>[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/portal/dashboard', icon: 'home', position: 1, visible: 1, badge_key: null },
  { id: 'arb-requests', label: 'ARB Requests', href: '/portal/requests', icon: 'clipboard', position: 2, visible: 1, badge_key: 'nonFinalCount' },
  { id: 'maintenance', label: 'Maintenance', href: '/portal/maintenance', icon: 'wrench', position: 3, visible: 1, badge_key: 'maintenanceOpenCount' },
  { id: 'meetings', label: 'Meetings', href: '/portal/meetings', icon: 'calendar', position: 4, visible: 1, badge_key: 'meetingsRsvpCount' },
  { id: 'directory', label: 'Directory', href: '/portal/directory', icon: 'users', position: 5, visible: 1, badge_key: null },
  { id: 'vendors', label: 'Vendors', href: '/portal/vendors', icon: 'briefcase', position: 6, visible: 1, badge_key: null },
  { id: 'documents', label: 'Documents', href: '/portal/documents', icon: 'folder', position: 7, visible: 1, badge_key: null },
  { id: 'dues', label: 'Dues', href: '/portal/assessments', icon: 'dollar', position: 8, visible: 1, badge_key: null },
  { id: 'feedback', label: 'Feedback', href: '/portal/feedback', icon: 'message', position: 9, visible: 1, badge_key: 'feedbackDueCount' },
  { id: 'library', label: 'Library', href: '/portal/library', icon: 'book', position: 10, visible: 1, badge_key: 'libraryItemCount' },
];

/**
 * Get all menu items ordered by position
 */
export async function getMenuItems(db: D1Database): Promise<MenuItem[]> {
  try {
    const { results } = await db
      .prepare('SELECT * FROM menu_items ORDER BY position ASC')
      .all<MenuItem>();

    // If no items in database, return defaults
    if (!results || results.length === 0) {
      return DEFAULT_MENU_ITEMS.map(item => ({
        ...item,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    }

    return results;
  } catch (error) {
    console.error('[menu-db] Failed to get menu items:', error);
    // Fallback to defaults on error
    return DEFAULT_MENU_ITEMS.map(item => ({
      ...item,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }
}

/**
 * Update menu item (position or visibility)
 */
export async function updateMenuItem(
  db: D1Database,
  id: string,
  updates: MenuItemUpdate
): Promise<boolean> {
  try {
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.position !== undefined) {
      sets.push('position = ?');
      values.push(updates.position);
    }
    if (updates.visible !== undefined) {
      sets.push('visible = ?');
      values.push(updates.visible);
    }

    if (sets.length === 0) return false;

    sets.push("updated_at = datetime('now')");
    values.push(id);

    await db
      .prepare(`UPDATE menu_items SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return true;
  } catch (error) {
    console.error('[menu-db] Failed to update menu item:', error);
    return false;
  }
}

/**
 * Batch update menu item positions (for reordering)
 */
export async function updateMenuOrder(
  db: D1Database,
  items: Array<{ id: string; position: number }>
): Promise<boolean> {
  try {
    // Use transaction-like approach with multiple updates
    for (const item of items) {
      await db
        .prepare("UPDATE menu_items SET position = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(item.position, item.id)
        .run();
    }
    return true;
  } catch (error) {
    console.error('[menu-db] Failed to update menu order:', error);
    return false;
  }
}

/**
 * Toggle menu item visibility
 */
export async function toggleMenuItemVisibility(
  db: D1Database,
  id: string
): Promise<boolean> {
  try {
    await db
      .prepare("UPDATE menu_items SET visible = 1 - visible, updated_at = datetime('now') WHERE id = ?")
      .bind(id)
      .run();
    return true;
  } catch (error) {
    console.error('[menu-db] Failed to toggle visibility:', error);
    return false;
  }
}

/**
 * Reset menu items to defaults
 */
export async function resetMenuToDefaults(db: D1Database): Promise<boolean> {
  try {
    // Delete all existing items
    await db.prepare('DELETE FROM menu_items').run();

    // Insert defaults
    for (const item of DEFAULT_MENU_ITEMS) {
      await db
        .prepare(
          'INSERT INTO menu_items (id, label, href, icon, position, visible, badge_key) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(item.id, item.label, item.href, item.icon, item.position, item.visible, item.badge_key)
        .run();
    }

    return true;
  } catch (error) {
    console.error('[menu-db] Failed to reset menu to defaults:', error);
    return false;
  }
}

/**
 * Check if menu_items table exists and has data
 */
export async function menuItemsTableExists(db: D1Database): Promise<boolean> {
  try {
    const result = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='menu_items'")
      .first();
    return !!result;
  } catch (error) {
    return false;
  }
}
