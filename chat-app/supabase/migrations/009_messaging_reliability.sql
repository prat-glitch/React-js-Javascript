-- Allow an existing browser subscription to refresh its endpoint keys.
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own subscriptions"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

-- Realtime must publish both message changes and unread-counter changes.
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.user_chats REPLICA IDENTITY FULL;

-- Old clients generated device numbers outside libsignal's valid 1..127
-- range. Retain those rows for audit, but never advertise or reuse them.
UPDATE public.signal_devices
SET is_active = FALSE
WHERE device_id < 1 OR device_id > 127;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signal_active_device_id_range'
  ) THEN
    ALTER TABLE public.signal_devices
      ADD CONSTRAINT signal_active_device_id_range
      CHECK (NOT is_active OR device_id BETWEEN 1 AND 127);
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_chats'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_chats';
    END IF;
  END IF;
END;
$$;
