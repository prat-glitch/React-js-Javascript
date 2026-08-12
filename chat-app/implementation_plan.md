# Implement Advanced Notifications & Unread Badges

The user wants to improve the notification system with the following features:
1. **Global Unread Badges:** Show the total number of unread chats on the "Chats" icon in the navigation bar.
2. **Offline Call Notifications:** Push notifications should wake up the device and show an "Incoming Call" alert even when the app is completely closed.

## Proposed Changes

### 1. Global Unread Badge (UI)

#### [MODIFY] `src/components/sidebar/Sidebar.jsx`
- Calculate the total number of unread chats from `Appcontext` (`Object.values(unreadChats).reduce((a,b) => a+b, 0)`).
- Update the `navItems` array to include an `unreadCount` property on the `messages` tab.
- Modify the render logic for the mobile bottom nav to display a red notification dot/badge if `unreadCount > 0`.

#### [MODIFY] `src/components/sidebar/NavigationMenu.jsx`
- Update the desktop left-rail navigation to also display the red notification badge on the "Chats" icon if `unreadCount > 0`.

### 2. Offline Call Notifications (Web Push)

Currently, calls use Supabase Realtime `broadcast` which only works if the app is open. We need to manually trigger our `send-push` Edge Function to send a Web Push when a call is initiated.

#### [MODIFY] `src/components/chatbox/Chatbox.jsx`
- When initiating an Audio or Video call, in addition to sending the `broadcast` event, we will invoke the `send-push` Edge Function directly via `supabase.functions.invoke('send-push', { body: { ... } })`.
- Payload will include: `isCall: true`, `callerName`, `callType`, and the `recipientId`.

#### [MODIFY] `supabase/functions/send-push/index.ts`
- Update the Edge Function to handle both database webhooks (for messages) AND direct invocations (for calls).
- If `isCall: true` is provided in the request body, build a specific push payload:
  - `title`: `Incoming ${callType} call...`
  - `body`: `${callerName} is calling you`
  - `isCall`: `true`
  - `requireInteraction`: `true` (so the notification stays on screen until the user taps it).

#### [MODIFY] `src/sw.js`
- Update the Service Worker to handle the rich call notification.
- Add "Answer" and "Decline" action buttons to the call notification.
- Update the `notificationclick` handler to route the user directly to the `/call/[id]?role=callee` page if they click "Answer", or just close the notification if they click "Decline".

## Verification Plan
1. Send a message to an offline user and verify the unread badge updates.
2. Initiate a call to a user whose app is completely closed.
3. Verify they receive a persistent Web Push notification with "Answer" and "Decline" buttons.
4. Verify clicking "Answer" opens the app directly to the call screen.
