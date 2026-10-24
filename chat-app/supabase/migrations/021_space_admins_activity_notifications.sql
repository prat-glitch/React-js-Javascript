-- Extend deployed 020 in place; existing memberships, sources and tasks are retained.
BEGIN;

ALTER TABLE public.space_members DROP CONSTRAINT space_members_role_check;
ALTER TABLE public.space_members ADD CONSTRAINT space_members_role_check
  CHECK (role IN ('owner', 'admin', 'member'));
ALTER TABLE public.space_messages
  ADD COLUMN kind text NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'system')),
  ADD COLUMN system_event jsonb,
  ADD CONSTRAINT space_messages_event_kind_check CHECK (
    (kind = 'message' AND system_event IS NULL) OR
    (kind = 'system' AND system_event IS NOT NULL AND jsonb_typeof(system_event) = 'object'
      AND system_event ? 'type' AND jsonb_typeof(system_event->'type') = 'string'
      AND system_event ? 'actor_id' AND jsonb_typeof(system_event->'actor_id') = 'string'
      AND system_event->>'actor_id' = sender_id::text AND attachment IS NULL));

CREATE FUNCTION public.space_is_admin(p_space_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.space_members WHERE space_id = p_space_id
    AND user_id = auth.uid() AND status = 'joined' AND role IN ('owner', 'admin'));
$$;

CREATE FUNCTION public.set_space_member_admin(p_space_id uuid, p_user_id uuid, p_admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  IF NOT public.space_is_admin(p_space_id) THEN RAISE EXCEPTION 'Only space admins can change admins.'; END IF;
  IF p_admin IS NULL THEN RAISE EXCEPTION 'Choose admin or member.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.space_members WHERE space_id = p_space_id
    AND user_id = p_user_id AND status = 'joined' AND role <> 'owner')
    THEN RAISE EXCEPTION 'Choose a joined non-owner member; the owner is protected.'; END IF;
  UPDATE public.space_members SET role = CASE WHEN p_admin THEN 'admin' ELSE 'member' END
    WHERE space_id = p_space_id AND user_id = p_user_id
      AND role IS DISTINCT FROM CASE WHEN p_admin THEN 'admin' ELSE 'member' END;
END;
$$;

CREATE FUNCTION public.remove_space_member(p_space_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  IF NOT public.space_is_admin(p_space_id) THEN RAISE EXCEPTION 'Only space admins can remove members.'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Use leave_space to leave yourself.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.space_members WHERE space_id = p_space_id
    AND user_id = p_user_id AND role <> 'owner' AND status IN ('joined', 'invited'))
    THEN RAISE EXCEPTION 'Choose a current non-owner member; the owner is protected.'; END IF;
  -- 020 requires a nonnull joined_at for every terminal left row, including a
  -- withdrawn invitation. Status remains left: this does not grant membership.
  UPDATE public.space_members SET status = 'left', joined_at = COALESCE(joined_at, clock_timestamp())
    WHERE space_id = p_space_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_space_members(p_space_id uuid, p_member_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ids uuid[];
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  IF NOT public.space_is_admin(p_space_id) THEN RAISE EXCEPTION 'Only space admins can invite members.'; END IF;
  IF array_position(p_member_ids, NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid space invitees.'; END IF;
  SELECT COALESCE(array_agg(DISTINCT u), '{}'::uuid[]) INTO v_ids FROM unnest(p_member_ids) u;
  IF cardinality(v_ids) > 19 THEN RAISE EXCEPTION 'A space allows at most 20 members including pending invitations.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_ids) u WHERE u = auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.basic_chats c WHERE c.member_a = least(auth.uid(), u) AND c.member_b = greatest(auth.uid(), u)))
    THEN RAISE EXCEPTION 'Invite only your own existing direct connections.'; END IF;
  IF EXISTS (SELECT 1 FROM public.space_members WHERE space_id = p_space_id AND user_id = ANY(v_ids)
    AND status IN ('declined','left')) THEN RAISE EXCEPTION 'Declined or left members cannot be invited again.'; END IF;
  IF (SELECT count(*) FROM public.space_members WHERE space_id = p_space_id AND status IN ('invited','joined'))
    + (SELECT count(*) FROM unnest(v_ids) u WHERE NOT EXISTS (
      SELECT 1 FROM public.space_members m WHERE m.space_id = p_space_id AND m.user_id = u)) > 20
    THEN RAISE EXCEPTION 'A space allows at most 20 members including pending invitations.'; END IF;
  INSERT INTO public.space_members (space_id, user_id, role, status, invited_by)
    SELECT p_space_id, u, 'member', 'invited', auth.uid() FROM unnest(v_ids) u
    ON CONFLICT (space_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_space_task(p_space_id uuid, p_title text, p_assignee_id uuid DEFAULT NULL,
  p_due_date date DEFAULT NULL, p_source_message_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  IF p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 240 THEN RAISE EXCEPTION 'Task title must be 1 to 240 characters.'; END IF;
  IF p_assignee_id IS NOT NULL THEN
    IF NOT public.space_is_admin(p_space_id) THEN RAISE EXCEPTION 'Only space admins can assign tasks.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.space_members WHERE space_id = p_space_id
      AND user_id = p_assignee_id AND status = 'joined') THEN RAISE EXCEPTION 'Assign tasks only to joined space members.'; END IF;
  END IF;
  IF p_source_message_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.space_messages
    WHERE space_id = p_space_id AND id = p_source_message_id) THEN RAISE EXCEPTION 'Source message must belong to this space.'; END IF;
  INSERT INTO public.space_tasks (space_id, title, assignee_id, due_date, created_by, source_message_id)
    VALUES (p_space_id, trim(p_title), p_assignee_id, p_due_date, auth.uid(), p_source_message_id)
    ON CONFLICT (space_id, source_message_id) DO UPDATE SET source_message_id = EXCLUDED.source_message_id RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_space_task(p_task_id uuid, p_title text, p_assignee_id uuid DEFAULT NULL,
  p_due_date date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_task public.space_tasks; v_space uuid;
BEGIN
  SELECT space_id INTO v_space FROM public.space_tasks WHERE id = p_task_id;
  PERFORM public.space_require_joined(v_space);
  -- Reread after the space lock: a concurrent reassignment/removal must not
  -- authorize an edit against a stale assignee or task snapshot.
  SELECT * INTO v_task FROM public.space_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task is not available.'; END IF;
  IF v_task.created_by <> auth.uid() AND NOT public.space_is_admin(v_space)
    THEN RAISE EXCEPTION 'Only the creator or space admins can edit a task.'; END IF;
  IF p_assignee_id IS DISTINCT FROM v_task.assignee_id AND NOT public.space_is_admin(v_space)
    THEN RAISE EXCEPTION 'Only space admins can change task assignments.'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 240 THEN RAISE EXCEPTION 'Task title must be 1 to 240 characters.'; END IF;
  IF p_assignee_id IS DISTINCT FROM v_task.assignee_id AND p_assignee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.space_members WHERE space_id = v_space AND user_id = p_assignee_id AND status = 'joined')
    THEN RAISE EXCEPTION 'Assign tasks only to joined space members.'; END IF;
  UPDATE public.space_tasks SET title = trim(p_title), assignee_id = p_assignee_id, due_date = p_due_date WHERE id = p_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_space_task_done(p_task_id uuid, p_done boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_task public.space_tasks; v_space uuid;
BEGIN
  SELECT space_id INTO v_space FROM public.space_tasks WHERE id = p_task_id;
  PERFORM public.space_require_joined(v_space);
  SELECT * INTO v_task FROM public.space_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task is not available.'; END IF;
  IF p_done IS NULL THEN RAISE EXCEPTION 'Choose done or open.'; END IF;
  IF v_task.assignee_id IS NOT NULL AND v_task.assignee_id <> auth.uid() AND NOT public.space_is_admin(v_space)
    THEN RAISE EXCEPTION 'Only the assignee or space admins can complete or reopen an assigned task.'; END IF;
  UPDATE public.space_tasks SET completed_at = CASE WHEN p_done THEN clock_timestamp() END,
    completed_by = CASE WHEN p_done THEN auth.uid() END
    WHERE id = p_task_id AND (completed_at IS NOT NULL) IS DISTINCT FROM p_done;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_space_task(p_task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_task public.space_tasks; v_space uuid;
BEGIN
  SELECT space_id INTO v_space FROM public.space_tasks WHERE id = p_task_id;
  PERFORM public.space_require_joined(v_space);
  SELECT * INTO v_task FROM public.space_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task is not available.'; END IF;
  IF v_task.created_by <> auth.uid() AND NOT public.space_is_admin(v_space)
    THEN RAISE EXCEPTION 'Only the creator or space admins can remove a task.'; END IF;
  DELETE FROM public.space_tasks WHERE id = p_task_id;
END;
$$;

CREATE TABLE public.space_task_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.space_tasks(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.basic_profiles(id),
  actor_id uuid NOT NULL REFERENCES public.basic_profiles(id),
  message_id uuid REFERENCES public.space_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  read_at timestamptz
);
CREATE INDEX space_task_notifications_unread_idx ON public.space_task_notifications (recipient_id, space_id, task_id)
  WHERE read_at IS NULL;
CREATE INDEX space_task_notifications_task_idx ON public.space_task_notifications (task_id);
ALTER TABLE public.space_task_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.space_task_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.space_task_notifications TO authenticated;
CREATE POLICY space_task_notifications_recipient_read ON public.space_task_notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid() AND public.space_is_joined(space_id));

CREATE FUNCTION public.mark_space_task_notifications_read(p_space_id uuid, p_notification_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.space_require_joined(p_space_id);
  IF p_notification_ids IS NULL OR cardinality(p_notification_ids) > 100
    OR array_position(p_notification_ids, NULL) IS NOT NULL THEN RAISE EXCEPTION 'Provide at most 100 notification ids.'; END IF;
  UPDATE public.space_task_notifications SET read_at = clock_timestamp()
    WHERE space_id = p_space_id AND recipient_id = auth.uid() AND id = ANY(p_notification_ids) AND read_at IS NULL;
END;
$$;

-- Internal-only plain prose helpers. Bodies are text, never HTML or encoded
-- message metadata. Strip markup/control characters even from legacy names.
CREATE FUNCTION public.space_activity_text(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT trim(regexp_replace(regexp_replace(COALESCE(p_text, ''), '<[^>]*>', '', 'g'),
    '[<>[:cntrl:]\u202a-\u202e\u2066-\u2069]', ' ', 'g'));
$$;
CREATE FUNCTION public.space_activity_name(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(NULLIF(public.space_activity_text(public.basic_public_display_name(
    (SELECT display_name FROM public.basic_profiles WHERE id = p_user_id))), ''), 'Samlap user');
$$;
CREATE FUNCTION public.space_append_activity(p_space_id uuid, p_type text, p_body text,
  p_target_id uuid DEFAULT NULL, p_task_id uuid DEFAULT NULL, p_decision_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  -- A missing auth actor during privileged maintenance is not user activity.
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.space_messages (space_id, sender_id, body, kind, system_event)
    VALUES (p_space_id, auth.uid(), p_body, 'system', jsonb_strip_nulls(jsonb_build_object(
      'type', p_type, 'actor_id', auth.uid(), 'target_id', p_target_id,
      'task_id', p_task_id, 'decision_id', p_decision_id))) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.space_member_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor text := public.space_activity_name(auth.uid()); v_target text := public.space_activity_name(NEW.user_id);
BEGIN
  -- Existing RPCs already hold this lock; keep lifecycle cleanup serialized
  -- with assignments even if a future trusted mutation uses this trigger.
  PERFORM 1 FROM public.spaces WHERE id = NEW.space_id FOR UPDATE;
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'owner' AND NEW.status = 'joined' THEN
      PERFORM public.space_append_activity(NEW.space_id, 'space_created', v_actor || ' created the group.');
    ELSIF NEW.status = 'invited' THEN
      PERFORM public.space_append_activity(NEW.space_id, 'member_invited', v_actor || ' invited ' || v_target || '.', NEW.user_id);
    END IF;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'joined' THEN
        PERFORM public.space_append_activity(NEW.space_id, 'member_joined', v_target || ' joined the group.', NEW.user_id);
      ELSIF NEW.status = 'left' THEN
        IF NEW.user_id = auth.uid() THEN
          PERFORM public.space_append_activity(NEW.space_id, 'member_left', v_target || ' left the group.', NEW.user_id);
        ELSE
          PERFORM public.space_append_activity(NEW.space_id, 'member_removed', v_actor || ' removed ' || v_target || '.', NEW.user_id);
        END IF;
        UPDATE public.space_tasks SET assignee_id = NULL
          WHERE space_id = NEW.space_id AND assignee_id = NEW.user_id AND completed_at IS NULL;
        UPDATE public.space_task_notifications SET read_at = clock_timestamp()
          WHERE space_id = NEW.space_id AND recipient_id = NEW.user_id AND read_at IS NULL;
      END IF;
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role AND NEW.status = 'joined' THEN
      PERFORM public.space_append_activity(NEW.space_id,
        CASE WHEN NEW.role = 'admin' THEN 'member_promoted' ELSE 'member_demoted' END,
        v_actor || CASE WHEN NEW.role = 'admin' THEN ' made ' ELSE ' dismissed ' END || v_target ||
          CASE WHEN NEW.role = 'admin' THEN ' an admin.' ELSE ' as an admin.' END, NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER space_member_activity AFTER INSERT OR UPDATE ON public.space_members
  FOR EACH ROW EXECUTE FUNCTION public.space_member_activity();

CREATE FUNCTION public.space_task_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_space uuid; v_task uuid; v_title text; v_actor text := public.space_activity_name(auth.uid());
  v_type text; v_message uuid; v_assigned boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN v_space := OLD.space_id; v_task := OLD.id; v_title := OLD.title;
  ELSE v_space := NEW.space_id; v_task := NEW.id; v_title := NEW.title; END IF;
  v_title := public.space_activity_text(v_title);
  IF TG_OP = 'INSERT' THEN
    PERFORM public.space_append_activity(v_space, 'task_created', v_actor || ' created task: ' || v_title, NULL, v_task);
    v_assigned := NEW.assignee_id IS NOT NULL;
    v_type := 'task_assigned';
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.space_append_activity(v_space, 'task_deleted', v_actor || ' deleted task: ' || v_title, NULL, v_task);
    -- The FK removes private notifications; the activity message remains.
    RETURN OLD;
  ELSE
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      UPDATE public.space_task_notifications SET read_at = clock_timestamp() WHERE task_id = v_task AND read_at IS NULL;
      IF NEW.assignee_id IS NULL THEN
        PERFORM public.space_append_activity(v_space, 'task_unassigned', v_actor || ' unassigned task: ' || v_title,
          OLD.assignee_id, v_task);
      ELSE
        v_assigned := true;
        v_type := CASE WHEN OLD.assignee_id IS NULL THEN 'task_assigned' ELSE 'task_reassigned' END;
      END IF;
    END IF;
    IF (NEW.title, NEW.due_date) IS DISTINCT FROM (OLD.title, OLD.due_date) THEN
      PERFORM public.space_append_activity(v_space, 'task_updated', v_actor || ' updated task: ' || v_title, NULL, v_task);
    END IF;
    IF (NEW.completed_at IS NULL) IS DISTINCT FROM (OLD.completed_at IS NULL) THEN
      PERFORM public.space_append_activity(v_space, CASE WHEN NEW.completed_at IS NULL THEN 'task_reopened' ELSE 'task_completed' END,
        v_actor || CASE WHEN NEW.completed_at IS NULL THEN ' reopened task: ' ELSE ' completed task: ' END || v_title, NULL, v_task);
    END IF;
  END IF;
  IF v_assigned THEN
    v_message := public.space_append_activity(v_space, v_type,
      v_actor || CASE WHEN v_type = 'task_reassigned' THEN ' reassigned task: ' ELSE ' assigned task: ' END ||
        v_title || ' to ' || public.space_activity_name(NEW.assignee_id) || '.', NEW.assignee_id, v_task);
    IF auth.uid() IS NOT NULL THEN
      INSERT INTO public.space_task_notifications (space_id, task_id, recipient_id, actor_id, message_id, read_at)
        VALUES (v_space, v_task, NEW.assignee_id, auth.uid(), v_message,
          CASE WHEN NEW.completed_at IS NOT NULL THEN clock_timestamp() END);
    END IF;
  END IF;
  IF NEW.completed_at IS NOT NULL THEN
    UPDATE public.space_task_notifications SET read_at = clock_timestamp() WHERE task_id = v_task AND read_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER space_task_activity AFTER INSERT OR UPDATE OR DELETE ON public.space_tasks
  FOR EACH ROW EXECUTE FUNCTION public.space_task_activity();

CREATE FUNCTION public.space_decision_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.space_append_activity(NEW.space_id, 'decision_pinned', public.space_activity_name(auth.uid()) ||
      ' pinned decision: ' || public.space_activity_text(NEW.body), NULL, NULL, NEW.id);
    RETURN NEW;
  END IF;
  PERFORM public.space_append_activity(OLD.space_id, 'decision_unpinned', public.space_activity_name(auth.uid()) ||
    ' unpinned decision: ' || public.space_activity_text(OLD.body), NULL, NULL, OLD.id);
  RETURN OLD;
END;
$$;
-- Source-message retries perform no-op UPDATEs in 020, not INSERTs.
CREATE TRIGGER space_decision_activity AFTER INSERT OR DELETE ON public.space_decisions
  FOR EACH ROW EXECUTE FUNCTION public.space_decision_activity();

CREATE FUNCTION public.notify_space_task_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE webhook_secret text;
BEGIN
  IF to_regnamespace('vault') IS NULL OR to_regnamespace('net') IS NULL THEN RETURN NEW; END IF;
  SELECT decrypted_secret INTO webhook_secret FROM vault.decrypted_secrets
    WHERE name = 'samlap_push_webhook_secret' LIMIT 1;
  IF webhook_secret IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://samlap.pratyushghosh.me/api/push/task-assignment',
    body := jsonb_build_object('type', 'INSERT', 'schema', 'public', 'table', 'space_task_notifications',
      'record', jsonb_build_object('id', NEW.id)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-webhook-secret', webhook_secret),
    timeout_milliseconds := 5000);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Samlap task push enqueue failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_space_task_push AFTER INSERT ON public.space_task_notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_space_task_push();

-- Read RPCs keep all existing public keys and pagination semantics.

CREATE OR REPLACE FUNCTION public.list_spaces()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue.'; END IF;
  SELECT jsonb_build_object('spaces', COALESCE((
    SELECT jsonb_agg(to_jsonb(q) - 'sort_at' ORDER BY q.sort_at DESC, q.id) FROM (
      SELECT s.id, s.title, s.purpose,
        (SELECT count(*) FROM public.space_members WHERE space_id = s.id AND status = 'joined') AS member_count,
        msg.body AS last_body, msg.created_at AS last_at, msg.kind AS last_kind,
        (SELECT count(*) FROM public.space_messages x WHERE x.space_id = s.id AND x.sender_id <> auth.uid()
          AND (x.created_at, x.id) > (COALESCE(m.last_read_at, '-infinity'::timestamptz),
            COALESCE(m.last_read_message_id, '00000000-0000-0000-0000-000000000000'::uuid))) AS unread_count,
        (SELECT count(*) FROM public.space_tasks WHERE space_id = s.id AND completed_at IS NULL) AS open_task_count,
        (SELECT count(*) FROM public.space_task_notifications n JOIN public.space_tasks t ON t.id = n.task_id
          WHERE n.space_id = s.id AND n.recipient_id = auth.uid() AND n.read_at IS NULL
            AND t.space_id = s.id AND t.assignee_id = auth.uid() AND t.completed_at IS NULL) AS task_notification_count,
        COALESCE(msg.created_at, s.created_at) AS sort_at
      FROM public.spaces s JOIN public.space_members m ON m.space_id = s.id
      LEFT JOIN LATERAL (SELECT body, created_at, kind FROM public.space_messages WHERE space_id = s.id
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

CREATE OR REPLACE FUNCTION public.get_space(p_space_id uuid)
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
    'task_notifications', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', n.id, 'task_id', n.task_id,
        'actor_id', n.actor_id, 'created_at', n.created_at) ORDER BY n.created_at DESC, n.id DESC), '[]'::jsonb)
      FROM public.space_task_notifications n JOIN public.space_tasks t ON t.id = n.task_id
      WHERE n.space_id = p_space_id AND n.recipient_id = auth.uid() AND n.read_at IS NULL
        AND t.space_id = p_space_id AND t.assignee_id = auth.uid() AND t.completed_at IS NULL),
    'links', (SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.created_at, l.id), '[]'::jsonb)
      FROM public.space_links l WHERE space_id = p_space_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.list_space_messages(p_space_id uuid, p_before timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL, p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.space_is_joined(p_space_id) THEN RAISE EXCEPTION 'Not a joined space member.'; END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR (p_before IS NULL AND p_before_id IS NOT NULL)
    THEN RAISE EXCEPTION 'Invalid message page cursor or limit.'; END IF;
  -- Timestamp-only callers retain strict-before semantics. Use both values for ties.
  RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC, q.id DESC), '[]'::jsonb) FROM (
    SELECT m.id, m.space_id, m.sender_id, m.body, m.created_at, m.attachment, m.kind, m.system_event,
      public.basic_public_display_name(p.display_name) AS sender_name
    FROM public.space_messages m JOIN public.basic_profiles p ON p.id = m.sender_id
    WHERE m.space_id = p_space_id AND (p_before IS NULL OR m.created_at < p_before
      OR (m.created_at = p_before AND p_before_id IS NOT NULL AND m.id < p_before_id))
    ORDER BY m.created_at DESC, m.id DESC LIMIT p_limit
  ) q);
END;
$$;

-- Global personal inbox: independent of whether a space list is mounted.
-- No acknowledgement side effects, arbitrary recipient argument, or contacts.
CREATE FUNCTION public.list_my_space_task_notifications()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue.'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC, q.id DESC), '[]'::jsonb) FROM (
    SELECT n.id, n.space_id, n.task_id, t.title AS task_title, s.title AS space_title,
      n.actor_id, public.space_activity_name(n.actor_id) AS actor_name, n.created_at
    FROM public.space_task_notifications n
      JOIN public.space_tasks t ON t.id = n.task_id AND t.space_id = n.space_id
      JOIN public.spaces s ON s.id = n.space_id
      JOIN public.space_members m ON m.space_id = n.space_id AND m.user_id = auth.uid() AND m.status = 'joined'
    WHERE n.recipient_id = auth.uid() AND n.read_at IS NULL AND t.assignee_id = auth.uid() AND t.completed_at IS NULL
    ORDER BY n.created_at DESC, n.id DESC LIMIT 100
  ) q);
END;
$$;

-- New and replaced functions get explicit ACLs, including under Supabase's
-- broad default privileges. Trigger helpers are never callable by clients.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature, p.proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = ANY(ARRAY[
      'space_is_admin', 'set_space_member_admin', 'remove_space_member', 'invite_space_members',
      'save_space_task', 'update_space_task', 'set_space_task_done', 'remove_space_task',
      'mark_space_task_notifications_read', 'list_my_space_task_notifications',
      'list_spaces', 'get_space', 'list_space_messages',
      'space_activity_text', 'space_activity_name', 'space_append_activity',
      'space_member_activity', 'space_task_activity', 'space_decision_activity', 'notify_space_task_push']) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    IF f.proname = ANY(ARRAY['space_is_admin', 'set_space_member_admin', 'remove_space_member', 'invite_space_members',
      'save_space_task', 'update_space_task', 'set_space_task_done', 'remove_space_task',
      'mark_space_task_notifications_read', 'list_my_space_task_notifications', 'list_spaces', 'get_space', 'list_space_messages']) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.signature);
    END IF;
  END LOOP;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'space_task_notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.space_task_notifications;
  END IF;
END $$;

-- The verified task-push route reads these trusted rows with the service key.
-- BYPASSRLS alone does not confer table privileges; do not rely on hosted defaults.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT ON public.space_task_notifications, public.space_tasks, public.space_members TO service_role;
  END IF;
END $$;

COMMIT;
