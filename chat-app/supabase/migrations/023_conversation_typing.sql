-- Ephemeral activity only: no draft text, message history or notifications.
BEGIN;

CREATE TABLE public.conversation_typing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES public.basic_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.basic_profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK ((space_id IS NULL) <> (chat_id IS NULL))
);
CREATE UNIQUE INDEX conversation_typing_space_session_idx
  ON public.conversation_typing (space_id, user_id, session_id) WHERE space_id IS NOT NULL;
CREATE UNIQUE INDEX conversation_typing_chat_session_idx
  ON public.conversation_typing (chat_id, user_id, session_id) WHERE chat_id IS NOT NULL;
CREATE INDEX conversation_typing_expiry_idx ON public.conversation_typing (expires_at);
ALTER TABLE public.conversation_typing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_typing FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.conversation_typing TO authenticated;
CREATE POLICY conversation_typing_member_read ON public.conversation_typing
  FOR SELECT TO authenticated USING (
    (space_id IS NOT NULL AND public.space_is_joined(space_id)) OR
    (chat_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.basic_chats c
      WHERE c.id = chat_id AND auth.uid() IN (c.member_a, c.member_b)))
  );

CREATE FUNCTION public.set_conversation_typing(p_conversation_id uuid, p_kind text,
  p_session_id uuid, p_typing boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_now timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL OR p_session_id IS NULL OR p_typing IS NULL
    OR p_kind IS NULL OR p_kind NOT IN ('space', 'chat') THEN
    RAISE EXCEPTION 'Invalid typing activity.';
  END IF;
  IF p_kind = 'space' THEN
    -- Serialize with membership removal so a departed user cannot renew activity.
    PERFORM public.space_require_joined(p_conversation_id);
  ELSIF NOT EXISTS (SELECT 1 FROM public.basic_chats c WHERE c.id = p_conversation_id
    AND auth.uid() IN (c.member_a, c.member_b)) THEN
    RAISE EXCEPTION 'Not a chat member.';
  END IF;

  -- Bound retention even when browsers vanish without a final stop request.
  DELETE FROM public.conversation_typing WHERE expires_at < v_now - interval '1 minute';
  IF NOT p_typing THEN
    -- UPDATE (rather than DELETE) delivers a stop through member-scoped Realtime RLS.
    UPDATE public.conversation_typing SET expires_at = v_now
      WHERE user_id = auth.uid() AND session_id = p_session_id AND
        CASE WHEN p_kind = 'space' THEN space_id = p_conversation_id ELSE chat_id = p_conversation_id END;
  ELSIF p_kind = 'space' THEN
    INSERT INTO public.conversation_typing (space_id, user_id, session_id, expires_at)
      VALUES (p_conversation_id, auth.uid(), p_session_id, v_now + interval '6 seconds')
      ON CONFLICT (space_id, user_id, session_id) WHERE space_id IS NOT NULL
      DO UPDATE SET expires_at = EXCLUDED.expires_at;
  ELSE
    INSERT INTO public.conversation_typing (chat_id, user_id, session_id, expires_at)
      VALUES (p_conversation_id, auth.uid(), p_session_id, v_now + interval '6 seconds')
      ON CONFLICT (chat_id, user_id, session_id) WHERE chat_id IS NOT NULL
      DO UPDATE SET expires_at = EXCLUDED.expires_at;
  END IF;
END;
$$;

CREATE FUNCTION public.list_conversation_typing(p_conversation_id uuid, p_kind text)
RETURNS TABLE (user_id uuid, ttl_ms integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('space', 'chat') OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Invalid typing conversation.';
  END IF;
  IF p_kind = 'space' THEN
    IF NOT public.space_is_joined(p_conversation_id) THEN RAISE EXCEPTION 'Not a joined space member.'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.basic_chats c WHERE c.id = p_conversation_id
    AND auth.uid() IN (c.member_a, c.member_b)) THEN
    RAISE EXCEPTION 'Not a chat member.';
  END IF;
  -- Derive remaining lifetime on the server; browser clock differences do not matter.
  -- Multiple devices become one user, and removed members disappear immediately.
  RETURN QUERY SELECT t.user_id,
    least(6000, ceil(extract(epoch FROM (max(t.expires_at) - statement_timestamp())) * 1000)::integer)
    FROM public.conversation_typing t
    WHERE t.user_id <> auth.uid() AND t.expires_at > statement_timestamp()
      AND CASE WHEN p_kind = 'space' THEN t.space_id = p_conversation_id
        AND EXISTS (SELECT 1 FROM public.space_members m WHERE m.space_id = p_conversation_id
          AND m.user_id = t.user_id AND m.status = 'joined')
        ELSE t.chat_id = p_conversation_id END
    GROUP BY t.user_id ORDER BY t.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_conversation_typing(uuid, text, uuid, boolean),
  public.list_conversation_typing(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_conversation_typing(uuid, text, uuid, boolean),
  public.list_conversation_typing(uuid, text) TO authenticated;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_typing;
  END IF;
END $$;
COMMIT;
