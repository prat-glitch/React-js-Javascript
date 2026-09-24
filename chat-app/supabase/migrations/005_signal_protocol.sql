-- Browser-device Signal Protocol directory.
-- Only public identity/pre-key material is stored in Supabase. Identity private
-- keys, ratchet sessions and plaintext caches remain in each device's IndexedDB.

CREATE TABLE IF NOT EXISTS public.signal_devices (
  user_id TEXT NOT NULL,
  device_id BIGINT NOT NULL CHECK (device_id > 0),
  registration_id INTEGER NOT NULL CHECK (registration_id BETWEEN 1 AND 16383),
  identity_key TEXT NOT NULL,
  signed_prekey_id BIGINT NOT NULL,
  signed_prekey_public TEXT NOT NULL,
  signed_prekey_signature TEXT NOT NULL,
  kyber_prekey_id BIGINT NOT NULL,
  kyber_prekey_public TEXT NOT NULL,
  kyber_prekey_signature TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS public.signal_prekeys (
  user_id TEXT NOT NULL,
  device_id BIGINT NOT NULL,
  key_id BIGINT NOT NULL,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  claimed_by TEXT,
  PRIMARY KEY (user_id, device_id, key_id),
  FOREIGN KEY (user_id, device_id)
    REFERENCES public.signal_devices(user_id, device_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS signal_prekeys_available_idx
  ON public.signal_prekeys(user_id, device_id, key_id)
  WHERE claimed_at IS NULL;

ALTER TABLE public.signal_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_prekeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read Signal devices" ON public.signal_devices;
CREATE POLICY "Authenticated users read Signal devices"
  ON public.signal_devices FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Users insert their Signal devices" ON public.signal_devices;
CREATE POLICY "Users insert their Signal devices"
  ON public.signal_devices FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

DROP POLICY IF EXISTS "Users update their Signal devices" ON public.signal_devices;
CREATE POLICY "Users update their Signal devices"
  ON public.signal_devices FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

DROP POLICY IF EXISTS "Users manage their Signal prekeys" ON public.signal_prekeys;
CREATE POLICY "Users manage their Signal prekeys"
  ON public.signal_prekeys FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

-- Atomically returns a device's public bundle and claims at most one classical
-- one-time pre-key. The signed and Kyber last-resort pre-keys remain reusable.
CREATE OR REPLACE FUNCTION public.claim_signal_prekey_bundle(
  p_user_id TEXT,
  p_device_id BIGINT
)
RETURNS TABLE (
  user_id TEXT,
  device_id BIGINT,
  registration_id INTEGER,
  identity_key TEXT,
  signed_prekey_id BIGINT,
  signed_prekey_public TEXT,
  signed_prekey_signature TEXT,
  kyber_prekey_id BIGINT,
  kyber_prekey_public TEXT,
  kyber_prekey_signature TEXT,
  prekey_id BIGINT,
  prekey_public TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester TEXT := auth.jwt() ->> 'sub';
  v_prekey_id BIGINT;
  v_prekey_public TEXT;
BEGIN
  IF v_requester IS NULL OR v_requester = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.key_id, p.public_key
    INTO v_prekey_id, v_prekey_public
  FROM public.signal_prekeys p
  WHERE p.user_id = p_user_id
    AND p.device_id = p_device_id
    AND p.claimed_at IS NULL
  ORDER BY p.key_id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_prekey_id IS NOT NULL THEN
    UPDATE public.signal_prekeys
    SET claimed_at = NOW(), claimed_by = v_requester
    WHERE signal_prekeys.user_id = p_user_id
      AND signal_prekeys.device_id = p_device_id
      AND signal_prekeys.key_id = v_prekey_id;
  END IF;

  RETURN QUERY
  SELECT d.user_id, d.device_id, d.registration_id, d.identity_key,
         d.signed_prekey_id, d.signed_prekey_public, d.signed_prekey_signature,
         d.kyber_prekey_id, d.kyber_prekey_public, d.kyber_prekey_signature,
         v_prekey_id, v_prekey_public
  FROM public.signal_devices d
  WHERE d.user_id = p_user_id
    AND d.device_id = p_device_id
    AND d.is_active = TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_signal_prekey_bundle(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_signal_prekey_bundle(TEXT, BIGINT) TO authenticated;

-- Exact contact lookup without exposing legacy private_key or unrelated rows.
CREATE OR REPLACE FUNCTION public.find_chat_user(p_identifier TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(u) - 'private_key'
  FROM public.users u
  WHERE lower(u.email) = lower(trim(p_identifier))
     OR regexp_replace(COALESCE(u.phone, ''), '[^0-9+]', '', 'g') =
        regexp_replace(trim(p_identifier), '[^0-9+]', '', 'g')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_chat_user(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_chat_user(TEXT) TO authenticated;

-- Safe replacement for the legacy SETOF users RPC, which returned every
-- column including the obsolete private_key backup column.
CREATE OR REPLACE FUNCTION public.get_chat_contacts_v2(p_uid TEXT)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(u) - 'private_key'
  FROM public.users u
  WHERE u.uid IN (
    SELECT uc.recipient_id
    FROM public.user_chats uc
    WHERE uc.owner_id = p_uid
  );
$$;

REVOKE ALL ON FUNCTION public.get_chat_contacts_v2(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_contacts_v2(TEXT) TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.signal_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signal_prekeys TO authenticated;
