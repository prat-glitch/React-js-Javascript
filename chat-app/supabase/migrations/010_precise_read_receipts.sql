-- Mark only the messages actually displayed. Never clear unread messages
-- outside the loaded page or messages arriving concurrently.
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_message_ids UUID[])
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_uid TEXT := auth.jwt() ->> 'sub';
  changed INTEGER;
BEGIN
  IF current_uid IS NULL OR current_uid = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  PERFORM 1 FROM public.user_chats uc
  WHERE uc.owner_id = current_uid AND uc.recipient_id IN (
    SELECT m.sender_id FROM public.messages m
    WHERE m.id = ANY(p_message_ids) AND m.recipient_id = current_uid
  ) ORDER BY uc.recipient_id FOR UPDATE;
  UPDATE public.messages m
  SET read_by = array_append(COALESCE(m.read_by, ARRAY[]::TEXT[]), current_uid)
  WHERE m.id = ANY(p_message_ids) AND m.recipient_id = current_uid
    AND NOT (current_uid = ANY(COALESCE(m.read_by, ARRAY[]::TEXT[])));
  GET DIAGNOSTICS changed = ROW_COUNT;
  UPDATE public.user_chats uc
  SET unread = (
    SELECT COUNT(*) FROM public.messages m
    WHERE m.recipient_id = current_uid AND m.sender_id = uc.recipient_id
      AND NOT (current_uid = ANY(COALESCE(m.read_by, ARRAY[]::TEXT[])))
  )
  WHERE uc.owner_id = current_uid AND uc.recipient_id IN (
    SELECT m.sender_id FROM public.messages m
    WHERE m.id = ANY(p_message_ids) AND m.recipient_id = current_uid
  );
  RETURN changed;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_messages_read(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(UUID[]) TO authenticated;
