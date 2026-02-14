-- Add paid_through_after to assessment_payments for receipts (periods covered by this payment).
-- Run: npm run db:assessment-paid-through-after:local or db:assessment-paid-through-after (remote)

ALTER TABLE assessment_payments ADD COLUMN paid_through_after TEXT;
