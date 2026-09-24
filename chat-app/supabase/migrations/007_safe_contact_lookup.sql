-- Do not let a non-existent email normalize to an empty phone string and match
-- a profile whose phone is null. Choose exactly one lookup mode.
CREATE OR REPLACE FUNCTION public.find_chat_user(p_identifier TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(u) - 'private_key'
  FROM public.users u
  WHERE CASE
    WHEN position('@' IN trim(p_identifier)) > 0
      THEN lower(u.email) = lower(trim(p_identifier))
    ELSE
      COALESCE(trim(u.phone), '') <> ''
      AND regexp_replace(u.phone, '[^0-9+]', '', 'g') =
          regexp_replace(trim(p_identifier), '[^0-9+]', '', 'g')
  END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_chat_user(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_chat_user(TEXT) TO authenticated;
