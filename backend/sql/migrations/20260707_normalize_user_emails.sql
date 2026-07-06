-- Normalize legacy user emails (trim + lowercase) and remove obvious duplicate test rows.
-- Run in Supabase SQL Editor for each production project as needed.

UPDATE users
SET email = trim(lower(email))
WHERE email <> trim(lower(email));

-- Optional: remove empty duplicate created after a mistyped registration test.
-- DELETE FROM users WHERE id = '885fc03f-2a7c-4684-9599-2d277ab682d4';
