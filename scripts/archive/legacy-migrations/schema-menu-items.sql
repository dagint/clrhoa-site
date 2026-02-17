-- Add menu_items table for customizable portal menu ordering
-- Allows admins to reorder and show/hide menu items without code changes
-- Run: npm run db:menu-items:local or db:menu-items (remote)

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  icon TEXT NOT NULL,
  position INTEGER NOT NULL,
  visible INTEGER DEFAULT 1,
  badge_key TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for sorting by position
CREATE INDEX IF NOT EXISTS idx_menu_items_position ON menu_items(position);

-- Insert default menu items (matches current PortalSidebar order)
INSERT INTO menu_items (id, label, href, icon, position, visible, badge_key) VALUES
  ('dashboard', 'Dashboard', '/portal/dashboard', 'home', 1, 1, NULL),
  ('arb-requests', 'ARB Requests', '/portal/requests', 'clipboard', 2, 1, 'nonFinalCount'),
  ('maintenance', 'Maintenance', '/portal/maintenance', 'wrench', 3, 1, 'maintenanceOpenCount'),
  ('meetings', 'Meetings', '/portal/meetings', 'calendar', 4, 1, 'meetingsRsvpCount'),
  ('directory', 'Directory', '/portal/directory', 'users', 5, 1, NULL),
  ('vendors', 'Vendors', '/portal/vendors', 'briefcase', 6, 1, NULL),
  ('documents', 'Documents', '/portal/documents', 'folder', 7, 1, NULL),
  ('dues', 'Dues', '/portal/assessments', 'dollar', 8, 1, NULL),
  ('feedback', 'Feedback', '/portal/feedback', 'message', 9, 1, 'feedbackDueCount'),
  ('library', 'Library', '/portal/library', 'book', 10, 1, 'libraryItemCount');
