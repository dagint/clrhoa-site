-- How payment was received and optional check number (for record payment).
ALTER TABLE assessment_payments ADD COLUMN payment_method TEXT;
ALTER TABLE assessment_payments ADD COLUMN check_number TEXT;
