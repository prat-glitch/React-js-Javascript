-- ── Migration 002: E2EE Public Keys & Scoped Contact Query ──────────────────
--
-- 1. Adds `public_key TEXT` to the `users` table.
--    Each client stores its ECDH P-256 public key (JWK JSON string) here.
--    The private key NEVER leaves the client (stored in IndexedDB).
--
-- 2. Creates get_chat_contacts(p_uid) RPC that returns only the users who
--    have an active conversation thread with `p_uid` — no global user listing.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Public key column
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_key TEXT;

-- 2. Scoped chat contacts RPC
--    Returns every user row for people who have a user_chats entry with p_uid.
CREATE OR REPLACE FUNCTION get_chat_contacts(p_uid TEXT)
RETURNS SETOF users
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT u.*
  FROM users u
  WHERE u.uid IN (
    SELECT uc.recipient_id
    FROM user_chats uc
    WHERE uc.owner_id = p_uid
  )
  ORDER BY u.username;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION get_chat_contacts(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_chat_contacts(TEXT) TO authenticated;
