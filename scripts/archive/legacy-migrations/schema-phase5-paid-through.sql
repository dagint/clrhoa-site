-- Phase 5 add-on: paid_through for full-year / future dues (avoids overdue/due reminders and notifications).
-- When today <= paid_through, owner is treated as current; exclude from any due/overdue email notifications.
-- Run after schema-phase5. For existing DBs that already ran phase5 before this column existed.
-- npm run db:phase5-paid-through:local | db:phase5-paid-through

ALTER TABLE assessments ADD COLUMN paid_through TEXT;
