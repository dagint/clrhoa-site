-- Florida HOA Compliance Requirements Table
-- Stores the 15 statutory requirements from FL §720.303(4)

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id TEXT PRIMARY KEY,                    -- e.g., 'HOA-01', 'HOA-15'
  statute_ref TEXT NOT NULL,              -- e.g., '§720.303(4)(b)1.a'
  title TEXT NOT NULL,                    -- Short title
  description TEXT NOT NULL,              -- Full requirement description
  category TEXT NOT NULL,                 -- 'governing_docs', 'financial', 'meetings', 'contracts', 'insurance', 'other'
  posting_location TEXT NOT NULL,         -- 'public' | 'members' | 'homepage'
  posting_deadline_days INTEGER,          -- NULL for static docs, 14 for meeting notices, etc.
  retention_years INTEGER DEFAULT 7,      -- How long to keep (7 years default, permanent for governing docs)
  requires_annual_update INTEGER DEFAULT 0, -- 1 if needs annual refresh (budgets, financial reports)
  is_repeating INTEGER DEFAULT 0,         -- 1 for meeting notices (recurring requirement)
  sort_order INTEGER DEFAULT 0            -- Display order
);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_category
  ON compliance_requirements(category);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_sort
  ON compliance_requirements(sort_order);
