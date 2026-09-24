# Samlap

A small Next.js + Supabase messaging app. It uses Supabase Auth (email/password or Google), stores messages in the same linked Supabase project, and does not require a recipient to open an updated client or register a device key before receiving messages.

## Run locally

1. Copy `.env.example` to `.env.local` and enter the Supabase URL and publishable/anon key. An existing `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` also works.
2. Run `npm install`.
3. Stop the old Vite server if it is still running. Run `npm run dev` and open http://localhost:5173.

The current chat and push schema is in migrations `012`–`018`. Earlier migration files remain as applied history; migrations `016`–`017` remove their old tables and policies. Migration `018` installs the direct push trigger.

In Supabase Authentication, enable Email and Google providers. Google is currently **disabled** on the linked project, so it must be configured before that button can work. Add your local and deployed URLs to URL Configuration redirect allow-list. Google sign-in also needs the Supabase OAuth callback configured in Google Cloud.

For immediate email/password signup without confirmation emails, open the linked project's **Authentication → Providers → Email** settings and turn off **Confirm Email**. The local config already has `auth.email.enable_confirmations = false`, but that local setting does not change the hosted project. Existing accounts waiting for confirmation may still need to be confirmed or recreated by the project owner.

## What changed

This is a fresh, simple chat system. Previous Firebase sign-ins do not carry over; each person creates a Supabase account. The old Firebase-era users, messages, push subscriptions, media files, and buckets were permanently removed after owner approval. New messages are stored as plain text in `basic_messages`, protected by Supabase row-level access policies. This is **not end-to-end encryption**. Do not use it for sensitive messages requiring E2EE.

The app includes direct text messages, search by exact email/phone, complete message history, live updates with polling fallback, unread counts, in-app alerts, and opt-in Web Push. Calls, file attachments, and chat deletion are not part of this basic version.

## Start a chat

Both people need Supabase Auth accounts; the old Firebase credentials do not sign them into this new app. Sign in at http://localhost:5173, search for the other person's exact email (or the phone number they saved in Settings), select **Start chat**, type a message, and press Send. The other person can be offline; the message stays in Supabase and appears when they sign in.

## Enable Web Push

The code and new `basic_push_subscriptions` table are installed. Push to a closed app needs a deployed HTTPS Next.js server and these setup steps:

1. Run `npx web-push generate-vapid-keys` once. Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY` in your local `.env.local` and deployment secrets. Keep this key pair stable; changing it requires users to subscribe again.
2. Set `VAPID_SUBJECT=mailto:your-real-contact-email`. Set `SUPABASE_SERVICE_ROLE_KEY` from the linked project's API keys, and set `PUSH_WEBHOOK_SECRET` to a long random string (for example, generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). These three values are server-only; never use a `NEXT_PUBLIC_` prefix for them or commit them.
3. Deploy Samlap on a host that runs Next.js API routes over HTTPS. Set the same five push environment variables there and rebuild so the public VAPID key reaches the browser.
4. The linked Supabase project already has a direct `pg_net` trigger on `basic_messages` and the shared secret in Vault. **Do not create a Dashboard webhook.** Its installed Database Webhooks integration is missing its helper function, so the direct trigger replaces that setup.
5. On **each device**, the recipient signs in, opens **Settings → Enable notifications**, and allows browser notifications. On iPhone/iPad, first open the HTTPS site in Safari, choose **Share → Add to Home Screen**, launch that installed app, then enable notifications there. A Safari tab cannot receive iPhone Web Push.
6. Tap **Send test notification** in Settings on that device. It should display a generic Samlap notification even while the app is open. If it fails, the app reports a delivery error. Then test with two accounts: close Samlap on the recipient device, send a message from the other account, and tap the notification. Reopen the chat to see the unread badge clear.

Push payloads contain only a generic notice and chat ID, not message text. The subscription endpoint and keys stay server-side behind Supabase Auth. The app plays a short sound for new messages while visible, including in an open chat; browsers require a user tap/key press before page audio is allowed. Push notifications display even if the app is visible. When it is closed, the phone/browser controls the notification sound (including silent mode, Focus/Do Not Disturb, and site permissions); Web Push cannot force a custom sound.
