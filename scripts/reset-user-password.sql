-- Supabase SQL Editor: reset Auth password (cannot READ existing password — only set a new one)
-- Passwords are bcrypt hashes; plaintext is never stored.
--
-- Replace email/password below, then run in: Supabase Dashboard → SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users
SET
  encrypted_password = crypt('12345678', gen_salt('bf')),
  updated_at = now()
WHERE email = 'jamshedmsd589@gmail.com';

-- Verify the user row exists (password column will show a hash, not plain text)
SELECT id, email, updated_at, last_sign_in_at
FROM auth.users
WHERE email = 'jamshedmsd589@gmail.com';
