-- Reliable direct-message routing. New messages carry the recipient explicitly,
-- rather than attempting to parse a Firebase UID from a combined chat_id.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS recipient_id TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_recipient_id TEXT;
BEGIN
  v_recipient_id := NEW.recipient_id;
  IF v_recipient_id IS NULL AND position('_' in NEW.chat_id) > 0 THEN
    v_recipient_id := replace(replace(NEW.chat_id, NEW.sender_id, ''), '_', '');
  END IF;
  IF v_recipient_id IS NULL OR v_recipient_id = '' THEN RETURN NEW; END IF;

  INSERT INTO public.user_chats (owner_id, recipient_id, last_msg, updated_at, unread)
  VALUES (NEW.sender_id, v_recipient_id, COALESCE(NEW.text, ''), NEW.created_at, 0)
  ON CONFLICT (owner_id, recipient_id) DO UPDATE
    SET last_msg = EXCLUDED.last_msg, updated_at = EXCLUDED.updated_at;

  IF v_recipient_id <> NEW.sender_id THEN
    INSERT INTO public.user_chats (owner_id, recipient_id, last_msg, updated_at, unread)
    VALUES (v_recipient_id, NEW.sender_id, COALESCE(NEW.text, ''), NEW.created_at, 1)
    ON CONFLICT (owner_id, recipient_id) DO UPDATE
      SET last_msg = EXCLUDED.last_msg,
          updated_at = EXCLUDED.updated_at,
          unread = public.user_chats.unread + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
