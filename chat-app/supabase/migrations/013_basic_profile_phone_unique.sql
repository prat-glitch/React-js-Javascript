CREATE UNIQUE INDEX IF NOT EXISTS basic_profiles_phone_idx
ON public.basic_profiles (phone) WHERE phone IS NOT NULL;
