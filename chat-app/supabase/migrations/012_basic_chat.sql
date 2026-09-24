-- New Supabase Auth messaging. Legacy encrypted tables are untouched.
CREATE TABLE public.basic_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX basic_profiles_email_idx ON public.basic_profiles (lower(email));
CREATE TABLE public.basic_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_a uuid NOT NULL REFERENCES public.basic_profiles(id),
  member_b uuid NOT NULL REFERENCES public.basic_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT basic_chats_order CHECK (member_a < member_b),
  CONSTRAINT basic_chats_pair UNIQUE (member_a, member_b)
);
CREATE TABLE public.basic_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.basic_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.basic_profiles(id),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX basic_messages_history_idx ON public.basic_messages (chat_id, created_at, id);
CREATE INDEX basic_messages_unread_idx ON public.basic_messages (chat_id, sender_id) WHERE read_at IS NULL;
ALTER TABLE public.basic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basic_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basic_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY basic_profiles_own_read ON public.basic_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY basic_profiles_own_insert ON public.basic_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() AND lower(email) = lower(auth.jwt()->>'email'));
CREATE POLICY basic_profiles_own_update ON public.basic_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND lower(email) = lower(auth.jwt()->>'email'));
CREATE POLICY basic_chats_member_read ON public.basic_chats FOR SELECT TO authenticated USING (auth.uid() IN (member_a, member_b));
CREATE POLICY basic_messages_member_read ON public.basic_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.basic_chats c WHERE c.id = chat_id AND auth.uid() IN (c.member_a, c.member_b)));
CREATE POLICY basic_messages_member_insert ON public.basic_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.basic_chats c WHERE c.id = chat_id AND auth.uid() IN (c.member_a, c.member_b)));
CREATE FUNCTION public.find_basic_user(p_identifier text)
RETURNS TABLE (id uuid, display_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.email FROM public.basic_profiles p
  WHERE p.id <> auth.uid() AND (lower(p.email) = lower(trim(p_identifier)) OR
    (p.phone IS NOT NULL AND p.phone = regexp_replace(p_identifier, '[^0-9+]', '', 'g')))
  LIMIT 1;
$$;
CREATE FUNCTION public.create_basic_chat(p_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_other = auth.uid() THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.basic_profiles WHERE id = p_other) THEN RAISE EXCEPTION 'Recipient has not signed up'; END IF;
  INSERT INTO public.basic_chats (member_a, member_b)
  VALUES (least(auth.uid(), p_other), greatest(auth.uid(), p_other))
  ON CONFLICT (member_a, member_b) DO UPDATE SET member_a = EXCLUDED.member_a
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
CREATE FUNCTION public.list_basic_chats()
RETURNS TABLE (chat_id uuid, peer_id uuid, peer_name text, peer_email text, last_body text, last_at timestamptz, unread_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, p.id, p.display_name, p.email, last_msg.body, last_msg.created_at,
    (SELECT count(*) FROM public.basic_messages m WHERE m.chat_id = c.id AND m.sender_id <> auth.uid() AND m.read_at IS NULL)
  FROM public.basic_chats c
  JOIN public.basic_profiles p ON p.id = CASE WHEN c.member_a = auth.uid() THEN c.member_b ELSE c.member_a END
  LEFT JOIN LATERAL (SELECT m.body, m.created_at FROM public.basic_messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) last_msg ON true
  WHERE auth.uid() IN (c.member_a, c.member_b)
  ORDER BY last_msg.created_at DESC NULLS LAST, c.created_at DESC;
$$;
CREATE FUNCTION public.mark_basic_chat_read(p_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.basic_chats WHERE id = p_chat_id AND auth.uid() IN (member_a, member_b)) THEN RAISE EXCEPTION 'Not a chat member'; END IF;
  UPDATE public.basic_messages SET read_at = now() WHERE chat_id = p_chat_id AND sender_id <> auth.uid() AND read_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.find_basic_user(text), public.create_basic_chat(uuid), public.list_basic_chats(), public.mark_basic_chat_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_basic_user(text), public.create_basic_chat(uuid), public.list_basic_chats(), public.mark_basic_chat_read(uuid) TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.basic_profiles TO authenticated;
GRANT SELECT ON public.basic_chats TO authenticated;
GRANT SELECT, INSERT ON public.basic_messages TO authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'basic_messages'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.basic_messages; END IF;
END $$;
