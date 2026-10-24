-- Optional voting before a decision. Existing message decisions are unchanged.
BEGIN;

CREATE TABLE public.space_polls (
  id uuid PRIMARY KEY,
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (length(trim(question)) BETWEEN 1 AND 240),
  created_by uuid NOT NULL REFERENCES public.basic_profiles(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz,
  closed_by uuid REFERENCES public.basic_profiles(id),
  revision bigint NOT NULL DEFAULT 0,
  UNIQUE (space_id, id),
  CHECK ((closed_at IS NULL) = (closed_by IS NULL))
);
CREATE INDEX space_polls_page_idx ON public.space_polls(space_id, created_at DESC, id DESC);
CREATE INDEX space_polls_creator_idx ON public.space_polls(created_by, created_at);
CREATE TABLE public.space_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL,
  poll_id uuid NOT NULL,
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 120),
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 8),
  FOREIGN KEY (space_id, poll_id) REFERENCES public.space_polls(space_id, id) ON DELETE CASCADE,
  UNIQUE(poll_id, position),
  UNIQUE(space_id, poll_id, id)
);
CREATE UNIQUE INDEX space_poll_option_label_idx ON public.space_poll_options(poll_id, lower(trim(label)));
CREATE TABLE public.space_poll_votes (
  space_id uuid NOT NULL,
  poll_id uuid NOT NULL,
  voter_id uuid NOT NULL REFERENCES public.basic_profiles(id),
  option_id uuid NOT NULL,
  PRIMARY KEY(poll_id, voter_id),
  FOREIGN KEY(space_id, poll_id, option_id) REFERENCES public.space_poll_options(space_id, poll_id, id) ON DELETE CASCADE
);
CREATE INDEX space_poll_votes_option_idx ON public.space_poll_votes(poll_id, option_id);

ALTER TABLE public.space_decisions
  ADD COLUMN source_poll_id uuid,
  ADD COLUMN source_poll_option_id uuid,
  ADD COLUMN poll_result_snapshot jsonb,
  ADD CONSTRAINT space_decision_poll_source_fk FOREIGN KEY(space_id, source_poll_id, source_poll_option_id)
    REFERENCES public.space_poll_options(space_id, poll_id, id),
  ADD CONSTRAINT space_decision_poll_source_check CHECK (
    (source_poll_id IS NULL AND source_poll_option_id IS NULL AND poll_result_snapshot IS NULL) OR
    (source_poll_id IS NOT NULL AND source_poll_option_id IS NOT NULL AND poll_result_snapshot IS NOT NULL
      AND source_message_id IS NULL AND jsonb_typeof(poll_result_snapshot) = 'object')),
  ADD CONSTRAINT space_decision_one_per_poll UNIQUE(source_poll_id);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['space_polls','space_poll_options','space_poll_votes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.space_is_joined(space_id)%s)',
      t || '_read', t, CASE WHEN t = 'space_poll_votes' THEN ' AND voter_id = auth.uid()' ELSE '' END);
  END LOOP;
END $$;

-- Internal projection: aggregates are public to members; individual ballots
-- remain private. Closed ballots are retained even if a voter later leaves.
CREATE FUNCTION public.space_poll_json(p_poll_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_jsonb(p) || jsonb_build_object(
    'options', (SELECT jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label,
      'position', o.position, 'votes', (SELECT count(*) FROM public.space_poll_votes v WHERE v.poll_id = p.id AND v.option_id = o.id))
      ORDER BY o.position) FROM public.space_poll_options o WHERE o.poll_id = p.id),
    'total_votes', (SELECT count(*) FROM public.space_poll_votes v WHERE v.poll_id = p.id),
    'my_option_id', (SELECT v.option_id FROM public.space_poll_votes v WHERE v.poll_id = p.id AND v.voter_id = auth.uid()),
    'decision_id', (SELECT d.id FROM public.space_decisions d WHERE d.source_poll_id = p.id))
  FROM public.space_polls p WHERE p.id = p_poll_id;
$$;

CREATE FUNCTION public.get_space_poll(p_poll_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_space uuid;
BEGIN
  SELECT space_id INTO v_space FROM public.space_polls WHERE id = p_poll_id;
  IF NOT public.space_is_joined(v_space) THEN RAISE EXCEPTION 'Poll is not available to you.'; END IF;
  RETURN public.space_poll_json(p_poll_id);
END;
$$;

CREATE FUNCTION public.list_space_polls(p_space_id uuid, p_before timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL, p_limit int DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.space_is_joined(p_space_id) THEN RAISE EXCEPTION 'Not a joined space member.'; END IF;
  IF (p_before IS NULL) <> (p_before_id IS NULL) THEN RAISE EXCEPTION 'Provide both poll cursor values.'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(public.space_poll_json(p.id) ORDER BY p.created_at DESC, p.id DESC), '[]'::jsonb)
    FROM (SELECT id, created_at FROM public.space_polls WHERE space_id = p_space_id
      AND (p_before IS NULL OR (created_at, id) < (p_before, p_before_id))
      ORDER BY created_at DESC, id DESC LIMIT greatest(1, least(COALESCE(p_limit, 20), 50))) p);
END;
$$;

CREATE FUNCTION public.create_space_poll(p_space_id uuid, p_poll_id uuid, p_question text, p_options text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_existing public.space_polls; v_options text[]; v_event uuid;
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  IF p_poll_id IS NULL OR p_question IS NULL OR length(trim(p_question)) NOT BETWEEN 1 AND 240
    THEN RAISE EXCEPTION 'Enter a poll question of 1 to 240 characters.'; END IF;
  IF p_options IS NULL OR cardinality(p_options) NOT BETWEEN 2 AND 8 OR array_ndims(p_options) <> 1
    OR EXISTS (SELECT 1 FROM unnest(p_options) o WHERE o IS NULL OR length(trim(o)) NOT BETWEEN 1 AND 120)
    OR (SELECT count(DISTINCT lower(trim(o))) FROM unnest(p_options) o) <> cardinality(p_options)
    THEN RAISE EXCEPTION 'Provide 2 to 8 different options, each 1 to 120 characters.'; END IF;
  SELECT array_agg(trim(o) ORDER BY n) INTO v_options FROM unnest(p_options) WITH ORDINALITY AS x(o,n);
  SELECT * INTO v_existing FROM public.space_polls WHERE id = p_poll_id;
  IF FOUND THEN
    IF v_existing.space_id <> p_space_id OR v_existing.created_by <> auth.uid() OR v_existing.question <> trim(p_question)
      OR v_options IS DISTINCT FROM (SELECT array_agg(label ORDER BY position) FROM public.space_poll_options WHERE poll_id = p_poll_id)
      THEN RAISE EXCEPTION 'This poll request already exists with different details.'; END IF;
    RETURN p_poll_id;
  END IF;
  IF (SELECT count(*) FROM public.space_polls WHERE created_by = auth.uid() AND created_at > clock_timestamp() - interval '1 hour') >= 20
    THEN RAISE EXCEPTION 'You have created several polls. Please try again later.'; END IF;
  INSERT INTO public.space_polls(id, space_id, question, created_by) VALUES(p_poll_id, p_space_id, trim(p_question), auth.uid());
  INSERT INTO public.space_poll_options(space_id, poll_id, label, position)
    SELECT p_space_id, p_poll_id, o, n FROM unnest(v_options) WITH ORDINALITY AS x(o,n);
  v_event := public.space_append_activity(p_space_id, 'poll_created', public.space_activity_name(auth.uid()) ||
    ' started a poll: ' || public.space_activity_text(trim(p_question)) || ' · Vote in Decisions.');
  UPDATE public.space_messages SET system_event = system_event || jsonb_build_object('poll_id', p_poll_id) WHERE id = v_event;
  RETURN p_poll_id;
END;
$$;

CREATE FUNCTION public.vote_space_poll(p_poll_id uuid, p_option_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_space uuid; v_poll public.space_polls; v_changed int;
BEGIN
  SELECT space_id INTO v_space FROM public.space_polls WHERE id = p_poll_id;
  -- Membership, voting and closing serialize on the same group lock.
  PERFORM public.space_require_joined(v_space);
  SELECT * INTO v_poll FROM public.space_polls WHERE id = p_poll_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll is not available.'; END IF;
  IF v_poll.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Voting is closed for this poll.'; END IF;
  IF p_option_id IS NULL THEN
    DELETE FROM public.space_poll_votes WHERE poll_id = p_poll_id AND voter_id = auth.uid();
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.space_poll_options WHERE poll_id = p_poll_id AND id = p_option_id)
      THEN RAISE EXCEPTION 'Choose an option from this poll.'; END IF;
    INSERT INTO public.space_poll_votes(space_id, poll_id, voter_id, option_id) VALUES(v_space, p_poll_id, auth.uid(), p_option_id)
      ON CONFLICT(poll_id, voter_id) DO UPDATE SET option_id = EXCLUDED.option_id
      WHERE space_poll_votes.option_id IS DISTINCT FROM EXCLUDED.option_id;
  END IF;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  -- Realtime invalidation exposes no other member's ballot identity.
  IF v_changed > 0 THEN UPDATE public.space_polls SET revision = revision + 1 WHERE id = p_poll_id; END IF;
END;
$$;

CREATE FUNCTION public.close_space_poll(p_poll_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_space uuid; v_poll public.space_polls; v_event uuid;
BEGIN
  SELECT space_id INTO v_space FROM public.space_polls WHERE id = p_poll_id;
  PERFORM public.space_require_joined(v_space);
  SELECT * INTO v_poll FROM public.space_polls WHERE id = p_poll_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll is not available.'; END IF;
  IF v_poll.created_by <> auth.uid() AND NOT public.space_is_admin(v_space)
    THEN RAISE EXCEPTION 'Only the poll creator or group admins can close voting.'; END IF;
  IF v_poll.closed_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.space_polls SET closed_at = clock_timestamp(), closed_by = auth.uid(), revision = revision + 1 WHERE id = p_poll_id;
  v_event := public.space_append_activity(v_space, 'poll_closed', public.space_activity_name(auth.uid()) ||
    ' closed the poll: ' || public.space_activity_text(v_poll.question) || ' · Results in Decisions.');
  UPDATE public.space_messages SET system_event = system_event || jsonb_build_object('poll_id', p_poll_id) WHERE id = v_event;
END;
$$;

CREATE FUNCTION public.decide_space_poll(p_poll_id uuid, p_option_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_space uuid; v_poll public.space_polls; v_result jsonb; v_option jsonb; v_id uuid; v_max bigint;
BEGIN
  SELECT space_id INTO v_space FROM public.space_polls WHERE id = p_poll_id;
  PERFORM public.space_require_joined(v_space);
  SELECT * INTO v_poll FROM public.space_polls WHERE id = p_poll_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Poll is not available.'; END IF;
  IF v_poll.created_by <> auth.uid() AND NOT public.space_is_admin(v_space)
    THEN RAISE EXCEPTION 'Only the poll creator or group admins can pin a poll result.'; END IF;
  IF v_poll.closed_at IS NULL THEN RAISE EXCEPTION 'Close voting before pinning a result.'; END IF;
  v_result := public.space_poll_json(p_poll_id);
  SELECT max((o->>'votes')::bigint) INTO v_max FROM jsonb_array_elements(v_result->'options') o;
  SELECT o INTO v_option FROM jsonb_array_elements(v_result->'options') o WHERE o->>'id' = p_option_id::text;
  IF v_max = 0 THEN RAISE EXCEPTION 'No votes were cast. Pin a decision directly after discussing it with the group.'; END IF;
  IF v_option IS NULL OR (v_option->>'votes')::bigint <> v_max
    THEN RAISE EXCEPTION 'Choose one of the options with the most votes.'; END IF;
  SELECT id INTO v_id FROM public.space_decisions WHERE source_poll_id = p_poll_id;
  IF FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.space_decisions WHERE id = v_id AND source_poll_option_id = p_option_id)
      THEN RAISE EXCEPTION 'A different result is already pinned for this poll. Review the existing decision.'; END IF;
    RETURN v_id;
  END IF;
  INSERT INTO public.space_decisions(space_id, body, created_by, source_poll_id, source_poll_option_id, poll_result_snapshot)
    VALUES(v_space, v_poll.question || E'\n' || (v_option->>'label'), auth.uid(), p_poll_id, p_option_id,
      (v_result - 'my_option_id' - 'decision_id') || jsonb_build_object('selected_option_id', p_option_id)) RETURNING id INTO v_id;
  UPDATE public.space_polls SET revision = revision + 1 WHERE id = p_poll_id;
  RETURN v_id;
END;
$$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(ARRAY['space_poll_json','get_space_poll','list_space_polls',
      'create_space_poll','vote_space_poll','close_space_poll','decide_space_poll']) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    IF f.proname <> 'space_poll_json' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.signature); END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.space_polls;
  END IF;
END $$;
COMMIT;
