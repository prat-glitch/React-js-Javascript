-- Read receipts are updated through a narrowly scoped function so clients
-- cannot mark another user's messages as read.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_by TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE OR REPLACE FUNCTION public.mark_messages_read(p_message_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed INTEGER;
  current_uid TEXT := auth.jwt() ->> 'sub';
BEGIN
  IF current_uid IS NULL OR current_uid = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.messages AS m
  SET read_by = array_append(COALESCE(m.read_by, ARRAY[]::TEXT[]), current_uid)
  WHERE m.id = ANY(p_message_ids)
    AND m.recipient_id = current_uid
    AND NOT (current_uid = ANY(COALESCE(m.read_by, ARRAY[]::TEXT[])));
  GET DIAGNOSTICS changed = ROW_COUNT;

  UPDATE public.user_chats AS uc
  SET unread = 0
  WHERE uc.owner_id = current_uid
    AND uc.recipient_id IN (
      SELECT DISTINCT m.sender_id
      FROM public.messages AS m
      WHERE m.id = ANY(p_message_ids)
        AND m.recipient_id = current_uid
    );

  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(UUID[]) TO authenticated;
