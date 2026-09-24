-- Public-only historical keys let contacts decrypt messages created before a
-- key reconciliation. Private keys remain in each user's local keyring.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS public_key_history JSONB NOT NULL DEFAULT '[]'::jsonb;
