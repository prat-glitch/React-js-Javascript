-- Confirmed by the project owner: permanently remove Firebase-era chat data.
-- Keep auth.users and the new basic_* tables.
BEGIN;

DROP TRIGGER IF EXISTS on_new_message ON public.messages;
DROP TRIGGER IF EXISTS protect_signal_device_identity ON public.signal_devices;

-- Required dependency: this policy queries the legacy public.users table.
DROP POLICY IF EXISTS "Send encrypted message attachments" ON storage.objects;

DROP FUNCTION IF EXISTS public.claim_signal_prekey_bundle(text, bigint);
DROP FUNCTION IF EXISTS public.find_chat_user(text);
DROP FUNCTION IF EXISTS public.get_chat_contacts(text);
DROP FUNCTION IF EXISTS public.get_chat_contacts_v2(text);
DROP FUNCTION IF EXISTS public.handle_new_message();
DROP FUNCTION IF EXISTS public.mark_messages_read(uuid[]);
DROP FUNCTION IF EXISTS public.notify_new_message();
DROP FUNCTION IF EXISTS public.prevent_signal_identity_replacement();
DROP FUNCTION IF EXISTS public.update_user_chats_on_message();

DROP TABLE IF EXISTS public.messages;
DROP TABLE IF EXISTS public.user_chats;
DROP TABLE IF EXISTS public.signal_prekeys;
DROP TABLE IF EXISTS public.signal_devices;
DROP TABLE IF EXISTS public.push_subscriptions;
DROP TABLE IF EXISTS public.users;

COMMIT;
