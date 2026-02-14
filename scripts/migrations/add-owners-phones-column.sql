-- Migration: Add phones column to owners table
-- This column stores a JSON array of phone numbers
-- The code expects this column but it was missing

ALTER TABLE owners ADD COLUMN phones TEXT DEFAULT NULL;

-- Optionally populate it from phone, phone2, phone3 for existing records
-- This creates a JSON array: ["phone1", "phone2", "phone3"]
UPDATE owners
SET phones = (
  SELECT json_group_array(phone_val)
  FROM (
    SELECT phone AS phone_val WHERE phone IS NOT NULL AND phone != ''
    UNION ALL
    SELECT phone2 AS phone_val WHERE phone2 IS NOT NULL AND phone2 != ''
    UNION ALL
    SELECT phone3 AS phone_val WHERE phone3 IS NOT NULL AND phone3 != ''
  )
)
WHERE phones IS NULL AND (phone IS NOT NULL OR phone2 IS NOT NULL OR phone3 IS NOT NULL);
