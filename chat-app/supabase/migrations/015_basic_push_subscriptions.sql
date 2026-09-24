-- Browser push endpoints for the new Supabase Auth chat only.
CREATE TABLE public.basic_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX basic_push_subscriptions_user_idx ON public.basic_push_subscriptions (user_id);
ALTER TABLE public.basic_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.basic_push_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.basic_push_subscriptions TO service_role;
