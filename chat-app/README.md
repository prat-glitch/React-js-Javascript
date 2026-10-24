# Samlap

A small Next.js + Supabase messaging app. It uses Supabase Auth (email/password or Google), stores messages in the same linked Supabase project, and does not require a recipient to open an updated client or register a device key before receiving messages.

## Run locally

1. Copy `.env.example` to `.env.local` and enter the Supabase URL and publishable/anon key. An existing `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` also works.
2. Run `npm install`.
3. Stop the old Vite server if it is still running. Run `npm run dev` and open http://localhost:5173.

The current schema is in migrations `012`–`022`. Earlier migration files remain as applied history; migrations `016`–`017` remove their old tables and policies. Migration `018` installs the direct push trigger. Migration `019` adds private profile links and recipient-approved chat requests. Migration `020` adds private conversation spaces, group invitations, attachments, links, decisions, and tasks. Migration `021` adds group admins, trusted activity messages, and private task assignment notifications. Migration `022` adds group polls and optional decisions linked to final results. Apply pending migrations with `supabase db push` before running this client against an existing project.

In Supabase Authentication, enable Email and Google providers. Google is currently **disabled** on the linked project, so it must be configured before that button can work. Add your local and deployed URLs to URL Configuration redirect allow-list. Google sign-in also needs the Supabase OAuth callback configured in Google Cloud.

For production identity verification, enable **Confirm Email** in the hosted project's **Authentication → Providers → Email** settings and configure a reliable SMTP provider. The connection functions require Supabase to mark an account's email as confirmed. If the project allows automatic confirmation, that field does **not** prove the person owns the email address. Local development currently allows automatic confirmation. Phone numbers are private, self-reported contact information and are not verified by this feature.

Add the deployed `/connect/*` URLs (and local equivalent during development) to the Supabase redirect allow-list so email confirmation and Google sign-in return users to the profile link they opened. Keep production redirect origins restricted to domains you control.

## What changed

This is a fresh, simple chat system. Previous Firebase sign-ins do not carry over; each person creates a Supabase account. The old Firebase-era users, messages, push subscriptions, media files, and buckets were permanently removed after owner approval. New messages are stored as plain text in `basic_messages`, protected by Supabase row-level access policies. This is **not end-to-end encryption**. Do not use it for sensitive messages requiring E2EE.

The app includes direct text messages, private profile links and QR codes, recipient-approved connection requests, complete message history, live updates with polling fallback, unread counts, in-app alerts, and opt-in direct-message Web Push. Conversation spaces add group chat, private attachments, categorized resources, pinned decisions, and assigned tasks. Calls and chat deletion are not included.

## Conversation spaces

Open **Chats → Spaces → New** to name a shared plan and invite your connections. People explicitly join before they can see its contents. Each space opens on **Chat**, with **Decisions** and **Tasks** beside it. The message **···** menu turns a message into an assigned task or a pinned decision, preserving a reference to the original message. Task deadlines are optional, and “Anyone” creates a shared checklist item.

Tap the **space name → Media, files and links** for categorized photos/videos/audio/GIFs, documents, and saved URLs. HTTP/HTTPS links in chat are collected automatically. Use **＋** in the composer for attachments up to 20 MiB; previews and downloads check membership through authenticated private Storage requests. The same people can belong to several independent spaces.

Open **Decisions → Polls → Create poll** to ask a question with 2–8 choices. Each joined member has one vote and can change or remove it while voting is open. Members see totals and their own choice; individual ballots stay private. The creator or a group admin closes voting, then optionally chooses **Make a decision** to pin a top result with its final counts. Ties require explicitly choosing an agreed tied option; zero-vote polls cannot become poll decisions. Nothing is pinned automatically. **Pin decision** and the message **··· → Pin as a decision** workflow remain available without a poll.

Spaces support 20 people including pending invitations. Group admins manage members and assign tasks. Members can create unassigned shared checklist items; assignees and admins can complete assigned tasks. Joins, departures, admin changes, task changes, and decisions appear as quiet system text in chat. Assignment alerts and badges are private to the assignee, with opt-in Web Push using the existing push setup and the new `/api/push/task-assignment` route. Ordinary group-message Web Push and ownership transfer remain unavailable. Success toasts dismiss after five seconds, assignment toasts after six, and transient action errors after eight; a new notice resets its timer. See [the workflow and system design](docs/conversation-spaces.md) for details.

## Start a chat

Both people need Supabase Auth accounts; the old Firebase credentials do not sign them into this new app. Sign in at http://localhost:5173 and complete your display name and private phone number in Settings. Email signup collects those fields; Google users complete their private profile after sign-in.

1. Open **My QR** to copy/share your profile link or save its QR image. QR generation happens locally; no third-party QR service receives the profile link.
2. The other person opens the link, pastes it under **Connect**, or chooses **Scan QR**. Scanning supports a camera or a saved image and only accepts links for the current app origin. Camera access requires HTTPS (or localhost); closing the scanner stops the camera.
3. Review the display name and choose **Send chat request**. Opening or scanning a link never automatically requests or accepts a chat.
4. The recipient opens **Requests** and chooses **Accept** or **Decline**. Only acceptance creates a new conversation. Pending, declined, and cancelled requests cannot send messages. Requests update live with a ten-second polling fallback; accepted senders can open their chat from Requests or the message list.
5. The sender can cancel a pending request. Cancellation imposes a 24-hour retry cooldown. Declined requests remain closed to prevent repeated unwanted invitations. Duplicate and reciprocal requests reuse the same pair instead of creating extra chats.

Public profile responses contain only a random share token, a contact-free display name, and the viewer's relationship status. Email and phone are visible only in the owner's private Settings. The database removes the old contact-lookup and instant-chat functions, denies direct profile/request/chat writes, and authorizes request responses using the verified session's `auth.uid()`. New request creation is limited to 20 per hour and 100 pending requests per sender, enforced in PostgreSQL. Existing conversations are preserved by the migration.

Run `npm test` for PostgreSQL-backed privacy/consent tests, including denied anonymous/outsider access, sender impersonation, duplicate and reciprocal requests, decline/cancel handling, and rate limits. The test database runs in memory with PGlite and does not connect to the hosted project.

## Typing indicators

Typing indicators work in direct messages and space chats after applying `supabase/migrations/023_conversation_typing.sql` and deploying the updated client. They show member names and animated dots above the composer, stop after three seconds without edits, and expire disconnected sessions after six seconds. Only authenticated conversation members can publish or read activity; draft text is never sent. See [typing implementation details](docs/conversation-spaces.md#typing-indicators).

## Emojis and GIFs

The message input stays at the bottom of the chat while the message history scrolls. The separate **Emojis** button opens a searchable emoji picker; **GIF** opens a ready-to-use reaction library. Search for hello, love, happy, thanks, cat, and other reactions. Select a GIF, optionally add a caption, then press Send. GIFs use the existing message table, so no new migration is needed. Both people need the updated app to see the GIF inline.

Emoji selection works immediately using `emoji-picker-react`. The built-in GIF reaction library requires no API key; its images load from GIPHY and need an internet connection. To enable live trending GIFs and full GIPHY search through the official `@giphy/js-fetch-api` package, create an API key at [GIPHY Developers](https://developers.giphy.com/dashboard/), set `GIPHY_API_KEY` in `.env.local` and your deployment environment, then restart/redeploy. Keep this variable server-only. The picker falls back to the searchable reaction library when the key is missing, live search fails, or the request times out.

## Enable Web Push

The code and new `basic_push_subscriptions` table are installed. Push to a closed app needs a deployed HTTPS Next.js server and these setup steps:

1. Run `npx web-push generate-vapid-keys` once. Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY` in your local `.env.local` and deployment secrets. Keep this key pair stable; changing it requires users to subscribe again.
2. Set `VAPID_SUBJECT=mailto:your-real-contact-email`. Set `SUPABASE_SERVICE_ROLE_KEY` from the linked project's API keys, and set `PUSH_WEBHOOK_SECRET` to a long random string (for example, generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). These three values are server-only; never use a `NEXT_PUBLIC_` prefix for them or commit them.
3. Deploy Samlap on a host that runs Next.js API routes over HTTPS. Set the same five push environment variables there and rebuild so the public VAPID key reaches the browser.
4. The linked Supabase project already has a direct `pg_net` trigger on `basic_messages` and the shared secret in Vault. **Do not create a Dashboard webhook.** Its installed Database Webhooks integration is missing its helper function, so the direct trigger replaces that setup.
5. On **each device**, the recipient signs in, opens **Settings → Enable notifications**, and allows browser notifications. On iPhone/iPad, first open the HTTPS site in Safari, choose **Share → Add to Home Screen**, launch that installed app, then enable notifications there. A Safari tab cannot receive iPhone Web Push.
6. Verify delivery with two accounts: close Samlap on the recipient device, send a real message from the other account, and tap the notification. Reopen the chat to see the unread badge clear. Production Settings contains only the notification opt-in control; diagnostic sound and notification controls and their test endpoint have been removed.

Push payloads contain only a generic notice and chat ID, not message text. The subscription endpoint and keys stay server-side behind Supabase Auth. The app plays one short sound as soon as a new message reaches a visible chat; a lightweight three-second check covers missed live events. Browsers require a user tap/key press before page audio is allowed. Push notifications can still display while the app is visible, but are silent there to avoid a second sound. Delayed push for a message already read in the open chat is skipped. When the app is closed, the phone/browser controls the notification sound (including silent mode, Focus/Do Not Disturb, and site permissions); Web Push cannot force a custom sound.
