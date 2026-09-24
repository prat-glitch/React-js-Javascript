-- Keep the long-term identity for a registered device immutable. A genuine
-- re-registration must use a new device id so contacts can detect the change.
CREATE OR REPLACE FUNCTION public.prevent_signal_identity_replacement()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.identity_key IS DISTINCT FROM OLD.identity_key
     OR NEW.registration_id IS DISTINCT FROM OLD.registration_id THEN
    RAISE EXCEPTION 'Signal device identity is immutable; register a new device';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_signal_device_identity ON public.signal_devices;
CREATE TRIGGER protect_signal_device_identity
BEFORE UPDATE ON public.signal_devices
FOR EACH ROW EXECUTE FUNCTION public.prevent_signal_identity_replacement();

-- These restrictive policies are ANDed with any existing permissive policies.
-- They prevent a broad historical policy from exposing ciphertext belonging to
-- unrelated conversations or allowing sender-id spoofing.
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "E2EE participants read messages" ON public.messages;
CREATE POLICY "E2EE participants read messages"
  ON public.messages AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    sender_id = (auth.jwt() ->> 'sub')
    OR recipient_id = (auth.jwt() ->> 'sub')
    OR EXISTS (
      SELECT 1
      FROM public.user_chats uc
      WHERE uc.owner_id = (auth.jwt() ->> 'sub')
        AND messages.chat_id = CASE
          WHEN uc.owner_id = uc.recipient_id THEN uc.owner_id || '_' || uc.owner_id
          WHEN uc.owner_id < uc.recipient_id THEN uc.owner_id || '_' || uc.recipient_id
          ELSE uc.recipient_id || '_' || uc.owner_id
        END
    )
  );

DROP POLICY IF EXISTS "E2EE users send as themselves" ON public.messages;
CREATE POLICY "E2EE users send as themselves"
  ON public.messages AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (auth.jwt() ->> 'sub')
    AND recipient_id IS NOT NULL
  );

DROP POLICY IF EXISTS "E2EE senders update their messages" ON public.messages;
CREATE POLICY "E2EE senders update their messages"
  ON public.messages AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (sender_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (
    sender_id = (auth.jwt() ->> 'sub')
    AND recipient_id IS NOT NULL
  );

DROP POLICY IF EXISTS "E2EE senders delete their messages" ON public.messages;
CREATE POLICY "E2EE senders delete their messages"
  ON public.messages AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (sender_id = (auth.jwt() ->> 'sub'));
