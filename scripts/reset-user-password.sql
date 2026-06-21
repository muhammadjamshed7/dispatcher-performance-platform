-- Supabase SQL Editor: set a new Auth password (optional — prefer Supabase Dashboard → Authentication → Users)
-- Replace YOUR_EMAIL and YOUR_NEW_PASSWORD below.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users
SET
  encrypted_password = crypt('YOUR_NEW_PASSWORD', gen_salt('bf')),
  updated_at = now()
WHERE email = 'YOUR_EMAIL';

SELECT id, email, updated_at, last_sign_in_at
FROM auth.users
WHERE email = 'YOUR_EMAIL';
