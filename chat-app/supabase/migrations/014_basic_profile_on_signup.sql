-- Make a new account discoverable even before it opens the chat screen again.
CREATE OR REPLACE FUNCTION public.create_basic_profile_for_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.basic_profiles (id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
             NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
             split_part(COALESCE(NEW.email, 'User'), '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS basic_profile_after_signup ON auth.users;
CREATE TRIGGER basic_profile_after_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_basic_profile_for_auth_user();
