-- The hosted project's Database Webhooks integration is installed, but its
-- supabase_functions.http_request() helper was not provisioned. Use pg_net
-- directly and keep the shared webhook secret in Supabase Vault.
CREATE OR REPLACE FUNCTION public.notify_basic_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  webhook_secret text;
BEGIN
  SELECT decrypted_secret
    INTO webhook_secret
    FROM vault.decrypted_secrets
   WHERE name = 'samlap_push_webhook_secret'
   LIMIT 1;

  IF webhook_secret IS NULL THEN
    RAISE WARNING 'Samlap push webhook secret is missing from Vault';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://samlap.pratyushghosh.me/api/push/message',
    body := jsonb_build_object(
      'type', 'INSERT',
      'schema', 'public',
      'table', 'basic_messages',
      'record', jsonb_build_object('id', NEW.id)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-webhook-secret', webhook_secret
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notification failures must never prevent a message from being saved.
  RAISE WARNING 'Samlap push enqueue failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_basic_message_push() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_basic_message_push
AFTER INSERT ON public.basic_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_basic_message_push();
