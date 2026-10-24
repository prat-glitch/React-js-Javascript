-- Group spaces are independent of DMs. Invitations never create basic_chats.
BEGIN;

CREATE TABLE public.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  purpose text NOT NULL DEFAULT '' CHECK (length(purpose) <= 2000),
  owner_id uuid NOT NULL REFERENCES public.basic_profiles(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX spaces_owner_created_idx ON public.spaces (owner_id, created_at);
CREATE TABLE public.space_members (
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.basic_profiles(id),
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  status text NOT NULL CHECK (status IN ('invited', 'joined', 'declined', 'left')),
  invited_by uuid NOT NULL REFERENCES public.basic_profiles(id),
  joined_at timestamptz,
  last_read_at timestamptz,
  last_read_message_id uuid,
  PRIMARY KEY (space_id, user_id),
  CHECK (role <> 'owner' OR status = 'joined'),
  CHECK (status NOT IN ('joined', 'left') OR joined_at IS NOT NULL)
);
CREATE UNIQUE INDEX space_members_one_owner_idx ON public.space_members (space_id) WHERE role = 'owner';
CREATE INDEX space_members_user_idx ON public.space_members (user_id, status, space_id);

-- Private uploads are immutable. Limits are also enforced by the Storage API.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('space-files', 'space-files', false, 20971520, ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/ogg', 'application/pdf', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'
]) ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE public.space_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.basic_profiles(id),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 10000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attachment jsonb,
  -- Internal FK closes the concurrent send/delete race; never part of RPC payloads.
  attachment_object_id uuid UNIQUE REFERENCES storage.objects(id) ON DELETE RESTRICT,
  CHECK ((attachment IS NULL) = (attachment_object_id IS NULL)),
  CHECK (length(trim(body)) > 0 OR attachment IS NOT NULL),
  UNIQUE (space_id, id)
);
CREATE UNIQUE INDEX space_messages_attachment_path_idx ON public.space_messages ((attachment->>'path'))
  WHERE attachment IS NOT NULL;
CREATE INDEX space_messages_history_idx ON public.space_messages (space_id, created_at DESC, id DESC);
CREATE INDEX space_messages_resources_idx ON public.space_messages (space_id, created_at DESC, id DESC)
  WHERE attachment IS NOT NULL OR body LIKE 'samlap:gif:v1:%';
CREATE TABLE public.space_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
  assignee_id uuid,
  due_date date,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.basic_profiles(id),
  created_by uuid NOT NULL REFERENCES public.basic_profiles(id),
  source_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (space_id, assignee_id) REFERENCES public.space_members(space_id, user_id),
  FOREIGN KEY (space_id, source_message_id) REFERENCES public.space_messages(space_id, id),
  UNIQUE (space_id, source_message_id),
  CHECK ((completed_at IS NULL) = (completed_by IS NULL))
);
CREATE INDEX space_tasks_space_idx ON public.space_tasks (space_id, created_at, id);
CREATE TABLE public.space_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  created_by uuid NOT NULL REFERENCES public.basic_profiles(id),
  source_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (space_id, source_message_id) REFERENCES public.space_messages(space_id, id),
  UNIQUE (space_id, source_message_id)
);
CREATE INDEX space_decisions_space_idx ON public.space_decisions (space_id, created_at, id);
CREATE TABLE public.space_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text NOT NULL CHECK (length(title) <= 240),
  created_by uuid NOT NULL REFERENCES public.basic_profiles(id),
  source_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (space_id, source_message_id) REFERENCES public.space_messages(space_id, id),
  UNIQUE (space_id, url)
);
CREATE INDEX space_links_space_idx ON public.space_links (space_id, created_at, id);

-- Policy helpers only answer questions about the caller, never about arbitrary users.
CREATE FUNCTION public.space_is_joined(p_space_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.space_members
    WHERE space_id = p_space_id AND user_id = auth.uid() AND status = 'joined');
$$;
CREATE FUNCTION public.space_require_joined(p_space_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- All space mutations take this lock before checking membership, including leave.
  PERFORM 1 FROM public.spaces WHERE id = p_space_id FOR UPDATE;
  IF NOT public.space_is_joined(p_space_id) THEN RAISE EXCEPTION 'Not a joined space member.'; END IF;
END;
$$;
CREATE FUNCTION public.space_require_profile()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL)
    THEN RAISE EXCEPTION 'Confirm your email before joining or creating spaces.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.basic_profiles WHERE id = auth.uid()
    AND phone ~ '^\+?[0-9]{7,15}$' AND length(trim(display_name)) BETWEEN 2 AND 60
    AND display_name = public.basic_public_display_name(display_name))
    THEN RAISE EXCEPTION 'Complete your private profile before joining or creating spaces.'; END IF;
END;
$$;
CREATE FUNCTION public.space_storage_access(p_name text, p_own boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  -- Compare canonical UUID text, avoiding casts of attacker-controlled path segments.
  SELECT COALESCE(p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (NOT p_own OR split_part(p_name, '/', 2) = auth.uid()::text)
    AND EXISTS (SELECT 1 FROM public.space_members m WHERE m.space_id::text = split_part(p_name, '/', 1)
      AND m.user_id = auth.uid() AND m.status = 'joined'), false);
$$;
CREATE FUNCTION public.space_upload_unattached(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.space_storage_access(p_name, true) AND NOT EXISTS (
    SELECT 1 FROM public.space_messages WHERE attachment->>'path' = p_name);
$$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['spaces','space_members','space_messages','space_tasks','space_decisions','space_links'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.space_is_joined(%I))',
      t || '_joined_read', t, CASE WHEN t = 'spaces' THEN 'id' ELSE 'space_id' END);
  END LOOP;
END $$;

CREATE POLICY space_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'space-files' AND public.space_storage_access(name, false));
CREATE POLICY space_files_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'space-files' AND public.space_storage_access(name, true));
CREATE POLICY space_files_cleanup ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'space-files' AND public.space_upload_unattached(name));
-- Restrictive guards prevent unrelated permissive bucket policies from widening access.
CREATE POLICY space_files_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING (bucket_id <> 'space-files' OR public.space_storage_access(name, false));
CREATE POLICY space_files_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK (bucket_id <> 'space-files' OR public.space_storage_access(name, true));
CREATE POLICY space_files_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC
  USING (bucket_id <> 'space-files' OR public.space_upload_unattached(name));
CREATE POLICY space_files_no_overwrite ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING (bucket_id <> 'space-files') WITH CHECK (bucket_id <> 'space-files');

CREATE FUNCTION public.invite_space_members(p_space_id uuid, p_member_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ids uuid[]; v_owner uuid;
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  SELECT owner_id INTO v_owner FROM public.spaces WHERE id = p_space_id;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION 'Only the space owner can invite members.'; END IF;
  IF array_position(p_member_ids, NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid space invitees.'; END IF;
  SELECT COALESCE(array_agg(DISTINCT u), '{}'::uuid[]) INTO v_ids FROM unnest(p_member_ids) u;
  IF cardinality(v_ids) > 19 THEN RAISE EXCEPTION 'A space allows at most 20 members including pending invitations.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_ids) u WHERE u = v_owner OR NOT EXISTS (
    SELECT 1 FROM public.basic_chats c WHERE c.member_a = least(v_owner, u) AND c.member_b = greatest(v_owner, u)))
    THEN RAISE EXCEPTION 'Invite only existing direct connections of the owner.'; END IF;
  IF EXISTS (SELECT 1 FROM public.space_members WHERE space_id = p_space_id AND user_id = ANY(v_ids)
    AND status IN ('declined','left')) THEN RAISE EXCEPTION 'Declined or left members cannot be invited again.'; END IF;
  IF (SELECT count(*) FROM public.space_members WHERE space_id = p_space_id AND status IN ('invited','joined'))
    + (SELECT count(*) FROM unnest(v_ids) u WHERE NOT EXISTS (
      SELECT 1 FROM public.space_members m WHERE m.space_id = p_space_id AND m.user_id = u)) > 20
    THEN RAISE EXCEPTION 'A space allows at most 20 members including pending invitations.'; END IF;
  INSERT INTO public.space_members (space_id, user_id, role, status, invited_by)
    SELECT p_space_id, u, 'member', 'invited', v_owner FROM unnest(v_ids) u
    ON CONFLICT (space_id, user_id) DO NOTHING;
END;
$$;
CREATE FUNCTION public.create_space(p_title text, p_purpose text, p_member_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.space_require_profile();
  IF p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 120
    OR length(COALESCE(p_purpose, '')) > 2000 THEN RAISE EXCEPTION 'Invalid space title or purpose.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 20));
  IF (SELECT count(*) FROM public.spaces WHERE owner_id = auth.uid()
    AND created_at > clock_timestamp() - interval '1 hour') >= 10
    THEN RAISE EXCEPTION 'Too many spaces. Limit is 10 spaces per hour.'; END IF;
  INSERT INTO public.spaces (title, purpose, owner_id) VALUES (trim(p_title), COALESCE(p_purpose, ''), auth.uid())
    RETURNING id INTO v_id;
  INSERT INTO public.space_members (space_id, user_id, role, status, invited_by, joined_at, last_read_at)
    VALUES (v_id, auth.uid(), 'owner', 'joined', auth.uid(), clock_timestamp(), clock_timestamp());
  PERFORM public.invite_space_members(v_id, p_member_ids);
  RETURN v_id;
END;
$$;
CREATE FUNCTION public.respond_space_invite(p_space_id uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.spaces WHERE id = p_space_id FOR UPDATE;
  IF p_accept IS NULL THEN RAISE EXCEPTION 'Choose accept or decline.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.space_members WHERE space_id = p_space_id
    AND user_id = auth.uid() AND status = 'invited') THEN RAISE EXCEPTION 'Invitation is not available to you.'; END IF;
  IF p_accept THEN PERFORM public.space_require_profile(); END IF;
  UPDATE public.space_members SET status = CASE WHEN p_accept THEN 'joined' ELSE 'declined' END,
    joined_at = CASE WHEN p_accept THEN clock_timestamp() END,
    last_read_at = CASE WHEN p_accept THEN clock_timestamp() END
    WHERE space_id = p_space_id AND user_id = auth.uid();
END;
$$;

CREATE FUNCTION public.list_spaces()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue.'; END IF;
  SELECT jsonb_build_object('spaces', COALESCE((
    SELECT jsonb_agg(to_jsonb(q) - 'sort_at' ORDER BY q.sort_at DESC, q.id) FROM (
      SELECT s.id, s.title, s.purpose,
        (SELECT count(*) FROM public.space_members WHERE space_id = s.id AND status = 'joined') AS member_count,
        msg.body AS last_body, msg.created_at AS last_at,
        (SELECT count(*) FROM public.space_messages x WHERE x.space_id = s.id AND x.sender_id <> auth.uid()
          AND (x.created_at, x.id) > (COALESCE(m.last_read_at, '-infinity'::timestamptz),
            COALESCE(m.last_read_message_id, '00000000-0000-0000-0000-000000000000'::uuid))) AS unread_count,
        (SELECT count(*) FROM public.space_tasks WHERE space_id = s.id AND completed_at IS NULL) AS open_task_count,
        COALESCE(msg.created_at, s.created_at) AS sort_at
      FROM public.spaces s JOIN public.space_members m ON m.space_id = s.id
      LEFT JOIN LATERAL (SELECT body, created_at FROM public.space_messages WHERE space_id = s.id
        ORDER BY created_at DESC, id DESC LIMIT 1) msg ON true
      WHERE m.user_id = auth.uid() AND m.status = 'joined'
    ) q), '[]'::jsonb), 'invitations', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('space_id', s.id, 'title', s.title, 'purpose', s.purpose,
      'inviter_name', public.basic_public_display_name(p.display_name),
      'member_count', (SELECT count(*) FROM public.space_members WHERE space_id = s.id AND status = 'joined'))
      ORDER BY s.created_at DESC, s.id)
    FROM public.space_members m JOIN public.spaces s ON s.id = m.space_id
      JOIN public.basic_profiles p ON p.id = m.invited_by
    WHERE m.user_id = auth.uid() AND m.status = 'invited'), '[]'::jsonb)) INTO v_result;
  RETURN v_result;
END;
$$;
CREATE FUNCTION public.get_space(p_space_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.space_is_joined(p_space_id) THEN RAISE EXCEPTION 'Not a joined space member.'; END IF;
  RETURN jsonb_build_object('space', (SELECT to_jsonb(s) FROM public.spaces s WHERE id = p_space_id),
    'members', (SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', m.user_id,
      'display_name', public.basic_public_display_name(p.display_name), 'role', m.role, 'status', m.status)
      ORDER BY (m.role = 'owner') DESC, m.user_id), '[]'::jsonb)
      FROM public.space_members m JOIN public.basic_profiles p ON p.id = m.user_id WHERE m.space_id = p_space_id),
    'tasks', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at, t.id), '[]'::jsonb)
      FROM public.space_tasks t WHERE space_id = p_space_id),
    'decisions', (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.created_at, d.id), '[]'::jsonb)
      FROM public.space_decisions d WHERE space_id = p_space_id),
    'links', (SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.created_at, l.id), '[]'::jsonb)
      FROM public.space_links l WHERE space_id = p_space_id));
END;
$$;

CREATE FUNCTION public.list_space_messages(p_space_id uuid, p_before timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL, p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.space_is_joined(p_space_id) THEN RAISE EXCEPTION 'Not a joined space member.'; END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR (p_before IS NULL AND p_before_id IS NOT NULL)
    THEN RAISE EXCEPTION 'Invalid message page cursor or limit.'; END IF;
  -- Timestamp-only callers retain strict-before semantics. Use both values for ties.
  RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC, q.id DESC), '[]'::jsonb) FROM (
    SELECT m.id, m.space_id, m.sender_id, m.body, m.created_at, m.attachment,
      public.basic_public_display_name(p.display_name) AS sender_name
    FROM public.space_messages m JOIN public.basic_profiles p ON p.id = m.sender_id
    WHERE m.space_id = p_space_id AND (p_before IS NULL OR m.created_at < p_before
      OR (m.created_at = p_before AND p_before_id IS NOT NULL AND m.id < p_before_id))
    ORDER BY m.created_at DESC, m.id DESC LIMIT p_limit
  ) q);
END;
$$;
CREATE FUNCTION public.list_space_resources(p_space_id uuid, p_kind text, p_before timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL, p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.space_is_joined(p_space_id) THEN RAISE EXCEPTION 'Not a joined space member.'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('media','files') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR (p_before IS NULL AND p_before_id IS NOT NULL) THEN RAISE EXCEPTION 'Invalid resource kind, cursor or limit.'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC, q.id DESC), '[]'::jsonb) FROM (
    SELECT m.id, m.space_id, m.sender_id, m.body, m.created_at, m.attachment,
      public.basic_public_display_name(p.display_name) AS sender_name
    FROM public.space_messages m JOIN public.basic_profiles p ON p.id = m.sender_id
    WHERE m.space_id = p_space_id AND (p_before IS NULL OR m.created_at < p_before
      OR (m.created_at = p_before AND p_before_id IS NOT NULL AND m.id < p_before_id))
      AND CASE WHEN p_kind = 'media' THEN m.body LIKE 'samlap:gif:v1:%'
        OR COALESCE(m.attachment->>'mime' ~ '^(image|video|audio)/', false)
        ELSE m.attachment IS NOT NULL AND m.attachment->>'mime' !~ '^(image|video|audio)/' END
    ORDER BY m.created_at DESC, m.id DESC LIMIT p_limit
  ) q);
END;
$$;

-- Conservative HTTP(S) authority validation, shared by explicit saves and indexing.
CREATE FUNCTION public.space_valid_url(p_url text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(length(p_url) BETWEEN 1 AND 2048
    AND p_url !~ '[[:space:][:cntrl:]<>"\\]'
    AND p_url ~* '^https?://(\[[0-9a-f:.]+\]|[a-z0-9]([a-z0-9.-]*[a-z0-9])?)(:[0-9]{1,5})?([/?#][^[:space:]]*)?$', false);
$$;
CREATE FUNCTION public.save_space_link(p_space_id uuid, p_url text, p_title text,
  p_source_message_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  IF NOT public.space_valid_url(p_url) OR p_title IS NULL OR length(p_title) > 240
    THEN RAISE EXCEPTION 'Use a valid HTTP/HTTPS URL and a title of at most 240 characters.'; END IF;
  IF p_source_message_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.space_messages
    WHERE space_id = p_space_id AND id = p_source_message_id) THEN RAISE EXCEPTION 'Source message must belong to this space.'; END IF;
  INSERT INTO public.space_links (space_id, url, title, created_by, source_message_id)
    VALUES (p_space_id, p_url, trim(p_title), auth.uid(), p_source_message_id)
    ON CONFLICT (space_id, url) DO UPDATE SET title = EXCLUDED.title RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.send_space_message(p_space_id uuid, p_body text, p_attachment jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_object storage.objects; v_match text[]; v_url text; v_close text; v_open text;
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  IF length(COALESCE(p_body, '')) > 10000 OR (length(trim(COALESCE(p_body, ''))) = 0 AND p_attachment IS NULL)
    THEN RAISE EXCEPTION 'Send text of at most 10000 characters or an attachment.'; END IF;
  IF p_attachment IS NOT NULL THEN
    IF jsonb_typeof(p_attachment) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid attachment object.'; END IF;
    IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_attachment) k) IS DISTINCT FROM ARRAY['mime','name','path','size']
      OR jsonb_typeof(p_attachment->'path') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p_attachment->'name') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p_attachment->'mime') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p_attachment->'size') IS DISTINCT FROM 'number'
      THEN RAISE EXCEPTION 'Attachment requires exactly path, name, mime and size.'; END IF;
    IF NOT public.space_storage_access(p_attachment->>'path', true)
      OR split_part(p_attachment->>'path', '/', 1) <> p_space_id::text
      OR length(p_attachment->>'name') NOT BETWEEN 1 AND 180
      OR p_attachment->>'name' ~ '[[:cntrl:]/\\]'
      OR p_attachment->>'size' !~ '^(0|[1-9][0-9]*)$'
      THEN RAISE EXCEPTION 'Invalid attachment path, filename or size.'; END IF;
    IF (p_attachment->>'size')::numeric NOT BETWEEN 1 AND 20971520 OR NOT EXISTS (SELECT 1 FROM storage.buckets
      WHERE id = 'space-files' AND p_attachment->>'mime' = ANY(allowed_mime_types))
      THEN RAISE EXCEPTION 'Attachment type or size is not allowed.'; END IF;
    SELECT * INTO v_object FROM storage.objects WHERE bucket_id = 'space-files'
      AND name = p_attachment->>'path' FOR UPDATE;
    IF v_object.id IS NULL THEN RAISE EXCEPTION 'Upload the attachment before sending.'; END IF;
    IF v_object.metadata->>'mimetype' IS DISTINCT FROM p_attachment->>'mime'
      OR COALESCE(v_object.metadata->>'size', '') !~ '^(0|[1-9][0-9]*)$'
      THEN RAISE EXCEPTION 'Attachment does not match trusted object metadata.'; END IF;
    IF (v_object.metadata->>'size')::numeric IS DISTINCT FROM (p_attachment->>'size')::numeric
      THEN RAISE EXCEPTION 'Attachment does not match trusted object metadata.'; END IF;
  END IF;
  INSERT INTO public.space_messages (space_id, sender_id, body, attachment, attachment_object_id)
    VALUES (p_space_id, auth.uid(), COALESCE(p_body, ''), p_attachment, v_object.id) RETURNING id INTO v_id;
  -- Encoded GIF metadata is opaque. Index plain bodies in the same transaction.
  IF left(COALESCE(p_body, ''), 14) <> 'samlap:gif:v1:' THEN
    FOR v_match IN SELECT regexp_matches(p_body, 'https?://[^[:space:]<>"\x27]+', 'gi') LOOP
      v_url := regexp_replace(v_match[1], '[.,;:!?]+$', '');
      -- Strip prose wrappers, retaining balanced URL parentheses and IPv6 brackets.
      WHILE right(v_url, 1) IN (')', ']', '}') LOOP
        v_close := right(v_url, 1);
        v_open := CASE v_close WHEN ')' THEN '(' WHEN ']' THEN '[' ELSE '{' END;
        EXIT WHEN length(v_url) - length(replace(v_url, v_close, ''))
          <= length(v_url) - length(replace(v_url, v_open, ''));
        v_url := regexp_replace(left(v_url, length(v_url) - 1), '[.,;:!?]+$', '');
      END LOOP;
      IF public.space_valid_url(v_url) THEN
        INSERT INTO public.space_links (space_id, url, title, created_by, source_message_id)
          VALUES (p_space_id, v_url, left(v_url, 240), auth.uid(), v_id)
          ON CONFLICT (space_id, url) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.mark_space_read(p_space_id uuid, p_message_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_at timestamptz;
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  IF p_message_id IS NULL THEN
    -- Compatibility callers acknowledge the latest stored message, never wall time.
    SELECT id, created_at INTO v_id, v_at FROM public.space_messages
      WHERE space_id = p_space_id ORDER BY created_at DESC, id DESC LIMIT 1;
    IF NOT FOUND THEN RETURN; END IF;
  ELSE
    SELECT id, created_at INTO v_id, v_at FROM public.space_messages
      WHERE space_id = p_space_id AND id = p_message_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Read message must belong to this space.'; END IF;
  END IF;
  -- The space lock serializes sends and acknowledgements; stale clients cannot
  -- move either part of the read cursor backwards, including timestamp ties.
  UPDATE public.space_members SET last_read_at = v_at, last_read_message_id = v_id
    WHERE space_id = p_space_id AND user_id = auth.uid()
      AND (COALESCE(last_read_at, '-infinity'::timestamptz),
        COALESCE(last_read_message_id, '00000000-0000-0000-0000-000000000000'::uuid)) < (v_at, v_id);
END;
$$;
CREATE FUNCTION public.save_space_task(p_space_id uuid, p_title text, p_assignee_id uuid DEFAULT NULL,
  p_due_date date DEFAULT NULL, p_source_message_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  IF p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 240 THEN RAISE EXCEPTION 'Task title must be 1 to 240 characters.'; END IF;
  IF p_assignee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.space_members
    WHERE space_id = p_space_id AND user_id = p_assignee_id AND status = 'joined')
    THEN RAISE EXCEPTION 'Assign tasks only to joined space members.'; END IF;
  IF p_source_message_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.space_messages
    WHERE space_id = p_space_id AND id = p_source_message_id) THEN RAISE EXCEPTION 'Source message must belong to this space.'; END IF;
  INSERT INTO public.space_tasks (space_id, title, assignee_id, due_date, created_by, source_message_id)
    VALUES (p_space_id, trim(p_title), p_assignee_id, p_due_date, auth.uid(), p_source_message_id)
    ON CONFLICT (space_id, source_message_id) DO UPDATE SET source_message_id = EXCLUDED.source_message_id RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
CREATE FUNCTION public.set_space_task_done(p_task_id uuid, p_done boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_space uuid;
BEGIN
  SELECT space_id INTO v_space FROM public.space_tasks WHERE id = p_task_id;
  PERFORM public.space_require_joined(v_space);
  IF p_done IS NULL THEN RAISE EXCEPTION 'Choose done or open.'; END IF;
  UPDATE public.space_tasks SET completed_at = CASE WHEN p_done THEN clock_timestamp() END,
    completed_by = CASE WHEN p_done THEN auth.uid() END
    WHERE id = p_task_id AND (completed_at IS NOT NULL) IS DISTINCT FROM p_done;
END;
$$;
CREATE FUNCTION public.update_space_task(p_task_id uuid, p_title text, p_assignee_id uuid DEFAULT NULL,
  p_due_date date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_task public.space_tasks;
BEGIN
  SELECT * INTO v_task FROM public.space_tasks WHERE id = p_task_id;
  PERFORM public.space_require_joined(v_task.space_id);
  IF v_task.created_by <> auth.uid() AND NOT EXISTS (SELECT 1 FROM public.spaces
    WHERE id = v_task.space_id AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'Only the creator or space owner can edit a task.'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 240 THEN RAISE EXCEPTION 'Task title must be 1 to 240 characters.'; END IF;
  IF p_assignee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.space_members
    WHERE space_id = v_task.space_id AND user_id = p_assignee_id AND status = 'joined')
    THEN RAISE EXCEPTION 'Assign tasks only to joined space members.'; END IF;
  UPDATE public.space_tasks SET title = trim(p_title), assignee_id = p_assignee_id, due_date = p_due_date
    WHERE id = p_task_id;
END;
$$;
CREATE FUNCTION public.remove_space_task(p_task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_task public.space_tasks;
BEGIN
  SELECT * INTO v_task FROM public.space_tasks WHERE id = p_task_id;
  PERFORM public.space_require_joined(v_task.space_id);
  IF v_task.created_by <> auth.uid() AND NOT EXISTS (SELECT 1 FROM public.spaces
    WHERE id = v_task.space_id AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'Only the creator or space owner can remove a task.'; END IF;
  DELETE FROM public.space_tasks WHERE id = p_task_id;
END;
$$;
CREATE FUNCTION public.save_space_decision(p_space_id uuid, p_body text, p_source_message_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  IF p_body IS NULL OR length(trim(p_body)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Decision must be 1 to 2000 characters.'; END IF;
  IF p_source_message_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.space_messages
    WHERE space_id = p_space_id AND id = p_source_message_id) THEN RAISE EXCEPTION 'Source message must belong to this space.'; END IF;
  INSERT INTO public.space_decisions (space_id, body, created_by, source_message_id)
    VALUES (p_space_id, trim(p_body), auth.uid(), p_source_message_id)
    ON CONFLICT (space_id, source_message_id) DO UPDATE SET source_message_id = EXCLUDED.source_message_id RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
CREATE FUNCTION public.remove_space_decision(p_decision_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_decision public.space_decisions;
BEGIN
  SELECT * INTO v_decision FROM public.space_decisions WHERE id = p_decision_id;
  PERFORM public.space_require_joined(v_decision.space_id);
  IF v_decision.created_by <> auth.uid() AND NOT EXISTS (SELECT 1 FROM public.spaces
    WHERE id = v_decision.space_id AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'Only the creator or space owner can remove a decision.'; END IF;
  DELETE FROM public.space_decisions WHERE id = p_decision_id;
END;
$$;
CREATE FUNCTION public.leave_space(p_space_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  IF EXISTS (SELECT 1 FROM public.spaces WHERE id = p_space_id AND owner_id = auth.uid())
    THEN RAISE EXCEPTION 'The owner cannot leave until ownership transfer is supported.'; END IF;
  UPDATE public.space_members SET status = 'left' WHERE space_id = p_space_id AND user_id = auth.uid();
  UPDATE public.space_tasks SET assignee_id = NULL
    WHERE space_id = p_space_id AND assignee_id = auth.uid() AND completed_at IS NULL;
END;
$$;

-- Supabase default privileges may grant new functions/tables broadly. Set explicit ACLs.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature, p.proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ANY(ARRAY[
      'space_is_joined','space_require_joined','space_require_profile','space_storage_access','space_upload_unattached','space_valid_url',
      'list_spaces','create_space','respond_space_invite','get_space','list_space_messages','list_space_resources','send_space_message',
      'mark_space_read','save_space_task','set_space_task_done','update_space_task','remove_space_task','save_space_decision','remove_space_decision','save_space_link',
      'invite_space_members','leave_space']) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    IF f.proname NOT IN ('space_require_joined','space_require_profile','space_valid_url') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.signature);
    END IF;
  END LOOP;
END $$;
-- PUBLIC restrictive policies evaluate these only for this private bucket. Anon
-- has no permissive policy and no table access to space data or RPCs.

DO $$ DECLARE t text; BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['spaces','space_members','space_messages','space_tasks','space_decisions','space_links'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;
