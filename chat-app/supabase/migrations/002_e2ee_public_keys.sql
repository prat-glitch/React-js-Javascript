-- ── Migration 002: E2EE Public Keys & Scoped Contact Query ──────────────────
--
-- 1. Adds `public_key TEXT` to the `users` table.
--    Each client stores its ECDH P-256 public key (JWK JSON string) here.
--    The private key NEVER leaves the client (stored in IndexedDB).
--
-- 2. Creates get_chat_contacts(p_uid) RPC that returns only the users who
--    have an active conversation thread with `p_uid` — no global user listing.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Public key and Private key backup columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS private_key TEXT;

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

-- 3. Unique Constraint on user_chats
--    Ensures ON CONFLICT upsert works reliably for the trigger.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_chats_owner_recipient_unique'
  ) THEN
    ALTER TABLE public.user_chats ADD CONSTRAINT user_chats_owner_recipient_unique UNIQUE (owner_id, recipient_id);
  END IF;
END;
$$;

-- 4. Automatically upsert user_chats on new messages
--    Creates/updates the thread records for both sender and recipient in a single transaction.
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_chat_id TEXT;
  v_sender_id TEXT;
  v_recipient_id TEXT;
  v_created_at BIGINT;
BEGIN
  v_chat_id := NEW.chat_id;
  v_sender_id := NEW.sender_id;
  v_created_at := NEW.created_at;
  
  -- Extract recipient_id from chat_id (uid1_uid2 format)
  IF position('_' in v_chat_id) > 0 THEN
    v_recipient_id := replace(replace(v_chat_id, v_sender_id, ''), '_', '');
  ELSE
    RETURN NEW;
  END IF;

  -- Upsert for the sender (owner_id = sender, recipient_id = recipient, unread = 0)
  INSERT INTO public.user_chats (owner_id, recipient_id, last_msg, updated_at, unread)
  VALUES (v_sender_id, v_recipient_id, NEW.text, v_created_at, 0)
  ON CONFLICT (owner_id, recipient_id)
  DO UPDATE SET 
    last_msg = EXCLUDED.last_msg,
    updated_at = EXCLUDED.updated_at;

  -- Upsert for the recipient (owner_id = recipient, recipient_id = sender, increments unread)
  INSERT INTO public.user_chats (owner_id, recipient_id, last_msg, updated_at, unread)
  VALUES (v_recipient_id, v_sender_id, NEW.text, v_created_at, 1)
  ON CONFLICT (owner_id, recipient_id)
  DO UPDATE SET 
    last_msg = EXCLUDED.last_msg,
    updated_at = EXCLUDED.updated_at,
    unread = public.user_chats.unread + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger to messages table
DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_message();

