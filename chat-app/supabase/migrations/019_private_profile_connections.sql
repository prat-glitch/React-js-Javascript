-- Profile links identify a person; only the recipient's acceptance creates a chat.
BEGIN;

ALTER TABLE public.basic_profiles
  ADD COLUMN share_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;

-- Phone numbers are private contact details, no longer account-discovery keys.
DROP INDEX IF EXISTS public.basic_profiles_phone_idx;
REVOKE ALL ON FUNCTION public.find_basic_user(text), public.create_basic_chat(uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.find_basic_user(text);
DROP FUNCTION public.create_basic_chat(uuid);

CREATE FUNCTION public.basic_public_display_name(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN length(trim(p_name)) BETWEEN 2 AND 60
    AND position('@' IN p_name) = 0
    AND p_name !~ '[0-9][0-9 ()+.-]{5,}[0-9]'
    THEN trim(p_name) ELSE 'Samlap user' END;
$$;
REVOKE ALL ON FUNCTION public.basic_public_display_name(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_basic_profile_for_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.basic_profiles (id, email, display_name, phone)
  VALUES (NEW.id, COALESCE(NEW.email, ''),
    public.basic_public_display_name(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'Samlap user')),
    CASE WHEN NEW.raw_user_meta_data->>'private_phone' ~ '^\+?[0-9]{7,15}$'
      THEN NEW.raw_user_meta_data->>'private_phone' ELSE NULL END)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_basic_profile_for_auth_user() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.ensure_basic_profile()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user auth.users; v_profile public.basic_profiles;
BEGIN
  SELECT * INTO v_user FROM auth.users WHERE id = auth.uid();
  IF v_user.id IS NULL THEN RAISE EXCEPTION 'Sign in to continue.'; END IF;
  INSERT INTO public.basic_profiles (id, email, display_name)
  VALUES (v_user.id, COALESCE(v_user.email, ''),
    public.basic_public_display_name(COALESCE(v_user.raw_user_meta_data->>'display_name',
      v_user.raw_user_meta_data->>'full_name', 'Samlap user')))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
  RETURNING * INTO v_profile;
  RETURN jsonb_build_object('display_name', public.basic_public_display_name(v_profile.display_name),
    'share_token', v_profile.share_token, 'phone', v_profile.phone);
END;
$$;

CREATE FUNCTION public.save_basic_profile(p_display_name text, p_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_profile public.basic_profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue.'; END IF;
  IF p_display_name IS NULL OR length(trim(p_display_name)) NOT BETWEEN 2 AND 60
    OR position('@' IN p_display_name) > 0 OR p_display_name ~ '[0-9][0-9 ()+.-]{5,}[0-9]'
    THEN RAISE EXCEPTION 'Use a display name of 2 to 60 characters without an email or phone number.'; END IF;
  IF p_phone IS NULL OR p_phone !~ '^\+?[0-9]{7,15}$'
    THEN RAISE EXCEPTION 'Enter a valid private phone number, including country code.'; END IF;
  UPDATE public.basic_profiles SET display_name = trim(p_display_name), phone = p_phone,
    updated_at = now() WHERE id = auth.uid() RETURNING * INTO v_profile;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Your profile is not ready. Sign in again.'; END IF;
  RETURN jsonb_build_object('display_name', v_profile.display_name, 'share_token', v_profile.share_token,
    'phone', v_profile.phone);
END;
$$;

-- All profile mutations now go through functions that take their identity from auth.uid().
REVOKE INSERT, UPDATE, DELETE ON public.basic_profiles FROM anon, authenticated;

CREATE TABLE public.basic_chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.basic_profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.basic_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  chat_id uuid REFERENCES public.basic_chats(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> recipient_id),
  CHECK ((status = 'accepted') = (chat_id IS NOT NULL))
);
CREATE UNIQUE INDEX basic_chat_requests_pair_idx ON public.basic_chat_requests
  (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
CREATE INDEX basic_chat_requests_recipient_idx ON public.basic_chat_requests (recipient_id, status);
CREATE INDEX basic_chat_requests_sender_idx ON public.basic_chat_requests (requester_id, requested_at);
ALTER TABLE public.basic_chat_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY basic_chat_requests_participant_read ON public.basic_chat_requests
  FOR SELECT TO authenticated USING (auth.uid() IN (requester_id, recipient_id));
REVOKE ALL ON public.basic_chat_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.basic_chat_requests TO authenticated;
-- No direct writes, including chats: RPC callers cannot bypass recipient consent.
REVOKE INSERT, UPDATE, DELETE ON public.basic_chats FROM anon, authenticated;

CREATE FUNCTION public.get_basic_profile_card(p_share_token uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_peer public.basic_profiles; v_request public.basic_chat_requests; v_chat uuid; v_state text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to view this profile.'; END IF;
  SELECT * INTO v_peer FROM public.basic_profiles WHERE share_token = p_share_token;
  IF v_peer.id IS NULL THEN RETURN NULL; END IF;
  IF v_peer.id = auth.uid() THEN v_state := 'self';
  ELSE
    SELECT id INTO v_chat FROM public.basic_chats
      WHERE member_a = least(auth.uid(), v_peer.id) AND member_b = greatest(auth.uid(), v_peer.id);
    IF v_chat IS NOT NULL THEN v_state := 'connected';
    ELSE
      SELECT * INTO v_request FROM public.basic_chat_requests
        WHERE least(requester_id, recipient_id) = least(auth.uid(), v_peer.id)
          AND greatest(requester_id, recipient_id) = greatest(auth.uid(), v_peer.id);
      v_state := CASE WHEN v_request.id IS NULL THEN 'available'
        WHEN v_request.status = 'pending' THEN
          CASE WHEN v_request.requester_id = auth.uid() THEN 'pending_outgoing' ELSE 'pending_incoming' END
        ELSE v_request.status END;
    END IF;
  END IF;
  RETURN jsonb_build_object('share_token', v_peer.share_token,
    'display_name', public.basic_public_display_name(v_peer.display_name),
    'status', v_state, 'request_id', v_request.id, 'chat_id', v_chat);
END;
$$;

CREATE FUNCTION public.send_basic_chat_request(p_share_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := auth.uid(); v_other uuid; v_request public.basic_chat_requests; v_chat uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in to send a chat request.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_me AND email_confirmed_at IS NOT NULL)
    THEN RAISE EXCEPTION 'Confirm your email before sending chat requests.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.basic_profiles WHERE id = v_me AND phone ~ '^\+?[0-9]{7,15}$')
    THEN RAISE EXCEPTION 'Complete your private profile before sending requests.'; END IF;
  SELECT id INTO v_other FROM public.basic_profiles WHERE share_token = p_share_token;
  IF v_other IS NULL THEN RAISE EXCEPTION 'This profile link is invalid or no longer available.'; END IF;
  IF v_me = v_other THEN RETURN jsonb_build_object('status', 'self'); END IF;
  -- Serialize rate checks for one sender, and requests in either direction for one pair.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_me::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(least(v_me, v_other)::text || ':' || greatest(v_me, v_other)::text, 1));
  SELECT id INTO v_chat FROM public.basic_chats
    WHERE member_a = least(v_me, v_other) AND member_b = greatest(v_me, v_other);
  IF v_chat IS NOT NULL THEN RETURN jsonb_build_object('status', 'connected', 'chat_id', v_chat); END IF;
  SELECT * INTO v_request FROM public.basic_chat_requests
    WHERE least(requester_id, recipient_id) = least(v_me, v_other)
      AND greatest(requester_id, recipient_id) = greatest(v_me, v_other) FOR UPDATE;
  IF v_request.status = 'accepted' THEN
    RETURN jsonb_build_object('status', 'connected', 'chat_id', v_request.chat_id);
  ELSIF v_request.status = 'pending' THEN
    RETURN jsonb_build_object('status', CASE WHEN v_request.requester_id = v_me
      THEN 'pending_outgoing' ELSE 'pending_incoming' END, 'request_id', v_request.id);
  ELSIF v_request.status = 'declined' THEN
    RETURN jsonb_build_object('status', 'declined', 'request_id', v_request.id);
  ELSIF v_request.status = 'cancelled' AND v_request.updated_at > now() - interval '24 hours' THEN
    RETURN jsonb_build_object('status', 'cancelled', 'request_id', v_request.id);
  END IF;
  IF (SELECT count(*) FROM public.basic_chat_requests WHERE requester_id = v_me
      AND requested_at > now() - interval '1 hour') >= 20
    OR (SELECT count(*) FROM public.basic_chat_requests WHERE requester_id = v_me AND status = 'pending') >= 100
    THEN RAISE EXCEPTION 'Too many chat requests. Please try again later.'; END IF;
  IF v_request.id IS NULL THEN
    INSERT INTO public.basic_chat_requests (requester_id, recipient_id) VALUES (v_me, v_other) RETURNING * INTO v_request;
  ELSE
    UPDATE public.basic_chat_requests SET requester_id = v_me, recipient_id = v_other, status = 'pending',
      requested_at = now(), updated_at = now() WHERE id = v_request.id RETURNING * INTO v_request;
  END IF;
  RETURN jsonb_build_object('status', 'pending_outgoing', 'request_id', v_request.id);
END;
$$;

CREATE FUNCTION public.respond_basic_chat_request(p_request_id uuid, p_accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := auth.uid(); v_request public.basic_chat_requests; v_chat uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in to respond.'; END IF;
  IF p_accept IS NULL THEN RAISE EXCEPTION 'Choose accept or decline.'; END IF;
  SELECT * INTO v_request FROM public.basic_chat_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL OR v_request.recipient_id <> v_me THEN
    RAISE EXCEPTION 'This request is not available to you.'; END IF;
  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('status', CASE WHEN v_request.status = 'accepted' THEN 'connected'
      ELSE v_request.status END, 'chat_id', v_request.chat_id);
  END IF;
  IF NOT p_accept THEN
    UPDATE public.basic_chat_requests SET status = 'declined', updated_at = now() WHERE id = v_request.id;
    RETURN jsonb_build_object('status', 'declined');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_me AND email_confirmed_at IS NOT NULL)
    THEN RAISE EXCEPTION 'Confirm your email before accepting chat requests.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.basic_profiles WHERE id = v_me AND phone ~ '^\+?[0-9]{7,15}$')
    THEN RAISE EXCEPTION 'Complete your private profile before accepting requests.'; END IF;
  INSERT INTO public.basic_chats (member_a, member_b)
    VALUES (least(v_request.requester_id, v_me), greatest(v_request.requester_id, v_me))
    ON CONFLICT (member_a, member_b) DO NOTHING;
  SELECT id INTO v_chat FROM public.basic_chats
    WHERE member_a = least(v_request.requester_id, v_me) AND member_b = greatest(v_request.requester_id, v_me);
  UPDATE public.basic_chat_requests SET status = 'accepted', chat_id = v_chat, updated_at = now() WHERE id = v_request.id;
  RETURN jsonb_build_object('status', 'connected', 'chat_id', v_chat);
END;
$$;

CREATE FUNCTION public.cancel_basic_chat_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.basic_chat_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue.'; END IF;
  SELECT * INTO v_request FROM public.basic_chat_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL OR v_request.requester_id <> auth.uid()
    THEN RAISE EXCEPTION 'This request is not available to you.'; END IF;
  IF v_request.status = 'pending' THEN
    UPDATE public.basic_chat_requests SET status = 'cancelled', updated_at = now() WHERE id = v_request.id;
    RETURN jsonb_build_object('status', 'cancelled');
  END IF;
  RETURN jsonb_build_object('status', CASE WHEN v_request.status = 'accepted' THEN 'connected'
    ELSE v_request.status END, 'chat_id', v_request.chat_id);
END;
$$;

CREATE FUNCTION public.list_basic_chat_requests()
RETURNS TABLE (request_id uuid, direction text, peer_name text, peer_token uuid, status text,
  chat_id uuid, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.id, CASE WHEN r.requester_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END,
    public.basic_public_display_name(p.display_name), p.share_token, r.status, r.chat_id, r.created_at, r.updated_at
  FROM public.basic_chat_requests r
  JOIN public.basic_profiles p ON p.id = CASE WHEN r.requester_id = auth.uid() THEN r.recipient_id ELSE r.requester_id END
  WHERE auth.uid() IN (r.requester_id, r.recipient_id)
  ORDER BY (r.status = 'pending') DESC, r.updated_at DESC LIMIT 100;
$$;

-- Remove contact details from chat payloads as well as the visible UI.
DROP FUNCTION public.list_basic_chats();
CREATE FUNCTION public.list_basic_chats()
RETURNS TABLE (chat_id uuid, peer_id uuid, peer_name text, peer_token uuid, last_body text,
  last_at timestamptz, unread_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.id, p.id, public.basic_public_display_name(p.display_name), p.share_token,
    last_msg.body, last_msg.created_at,
    (SELECT count(*) FROM public.basic_messages m WHERE m.chat_id = c.id AND m.sender_id <> auth.uid() AND m.read_at IS NULL)
  FROM public.basic_chats c
  JOIN public.basic_profiles p ON p.id = CASE WHEN c.member_a = auth.uid() THEN c.member_b ELSE c.member_a END
  LEFT JOIN LATERAL (SELECT m.body, m.created_at FROM public.basic_messages m WHERE m.chat_id = c.id
    ORDER BY m.created_at DESC, m.id DESC LIMIT 1) last_msg ON true
  WHERE auth.uid() IN (c.member_a, c.member_b)
  ORDER BY last_msg.created_at DESC NULLS LAST, c.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.ensure_basic_profile(), public.save_basic_profile(text, text),
  public.get_basic_profile_card(uuid), public.send_basic_chat_request(uuid),
  public.respond_basic_chat_request(uuid, boolean), public.cancel_basic_chat_request(uuid),
  public.list_basic_chat_requests(), public.list_basic_chats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_basic_profile(), public.save_basic_profile(text, text),
  public.get_basic_profile_card(uuid), public.send_basic_chat_request(uuid),
  public.respond_basic_chat_request(uuid, boolean), public.cancel_basic_chat_request(uuid),
  public.list_basic_chat_requests(), public.list_basic_chats() TO authenticated;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.basic_chat_requests;
  END IF;
END $$;

COMMIT;
