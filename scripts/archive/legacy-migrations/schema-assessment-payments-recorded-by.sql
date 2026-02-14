-- Add recorded_by to assessment_payments for audit (who recorded the payment).
-- Run: npm run db:assessment-recorded-by (remote) or db:assessment-recorded-by:local

ALTER TABLE assessment_payments ADD COLUMN recorded_by TEXT;
