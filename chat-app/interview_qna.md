# Chat App - Full Stack Developer Interview Q&A

This document contains a comprehensive set of interview questions and answers based on the architecture, technologies, and features implemented in this Chat App project. It is structured from basic concepts to advanced architectural decisions.

## Table of Contents
1. [Basic / Foundation Level](#basic--foundation-level)
2. [Intermediate Level (State & Routing)](#intermediate-level-state--routing)
3. [Advanced Level (Architecture & Hybrid Backend)](#advanced-level-architecture--hybrid-backend)
4. [Real-time & WebRTC](#real-time--webrtc)

---

## Basic / Foundation Level

**Q1: Why did you choose Vite over Create React App (CRA) for this project?**
**A:** Vite was chosen for its significantly faster development server and build times. Unlike CRA, which bundles the entire application using Webpack before serving it, Vite serves the code via native ES modules during development and uses esbuild (which is written in Go and is incredibly fast) for pre-bundling dependencies. For production, it uses Rollup, providing a highly optimized build.

**Q2: How is styling managed in this application?**
**A:** The application uses **Tailwind CSS** as a utility-first CSS framework. This allows for rapid UI development without writing custom CSS classes and keeping the bundle size small (via PurgeCSS/Tailwind's JIT compiler). Additionally, it uses **shadcn/ui** (built on top of Radix UI and Tailwind) for accessible, customizable, and reusable UI components. Libraries like `clsx` and `tailwind-merge` are used to handle dynamic class string merging cleanly.

**Q3: What is the purpose of `react-toastify` in this project?**
**A:** `react-toastify` is used for non-blocking, user-friendly notifications (toasts). In the app, it's utilized extensively in the authentication flows (`firebase.js`) to show success or error messages (e.g., when a user enters an incorrect password or successfully registers).

---

## Intermediate Level (State & Routing)

**Q4: How does routing work in this application?**
**A:** Routing is handled by **React Router DOM**. It enables client-side routing, allowing seamless navigation between pages like Login, Chat, Call, and Profile Update without full page reloads.

**Q5: How is global state managed in this application?**
**A:** Global state is managed using the **React Context API** (`Appcontext.jsx` and `Callcontext.jsx`). 
- `Appcontext` holds the authenticated user details, a list of all users, the user's active chats, the currently selected chat, and unread message counts. 
- `Callcontext` isolates the state required for WebRTC audio/video calls (active calls, peer connections, local streams). 
Context was chosen over Redux or Zustand because the state complexity is moderate, and Context provides a built-in, lightweight solution for prop-drilling without adding extra dependencies.

**Q6: Explain the route guard logic implemented in `Appcontext.jsx`.**
**A:** In the `loaduserdata` function within `Appcontext`, after fetching the user's profile from Supabase, the app checks if `profile_completed` is true. If it is true, and the user is not on the `/chat` route, they are redirected there. If the profile is incomplete, they are forced to the `/profile` route. This ensures users cannot access the main chat interface without setting up their profile first.

---

## Advanced Level (Architecture & Hybrid Backend)

**Q7: This project uses a hybrid backend approach (Firebase for Auth + Supabase for Database/Real-time). Why use this architecture instead of using Supabase Auth or Firebase Firestore exclusively?**
**A:** This is a crucial architectural decision.
- **Why Firebase Auth:** Firebase Authentication is highly mature, robust, and offers seamless integration with various social providers and excellent SDKs.
- **Why Supabase DB:** Supabase provides a PostgreSQL database, which offers powerful relational data modeling, complex queries, and Row Level Security (RLS). It also provides excellent built-in WebSocket support for real-time Postgres changes.
By combining them, the app leverages the best authentication service alongside a powerful, real-time relational database.

**Q8: How does the application authenticate Supabase requests if the user logs in via Firebase?**
**A:** The application uses a custom Token Exchange mechanism. 
1. When a user logs in or signs up via Firebase, the client retrieves the Firebase ID Token (`await user.getIdToken()`).
2. The client sends this token to a Supabase Edge Function (`/functions/v1/auth-token`).
3. The Edge Function verifies the Firebase token, generates a custom Supabase JWT for that specific user, and returns it.
4. The client then initializes the Supabase client using this custom JWT in the global headers (`setSupabaseToken` in `supabase.js`), ensuring all subsequent database requests are securely authenticated and respect Postgres Row Level Security (RLS).

**Q9: What happens if a user exists in Firebase Auth but their profile is missing in the Supabase `users` table?**
**A:** The `Appcontext` implements a robust fallback mechanism. If `getSupabase().from('users')` returns no data for the authenticated Firebase UID, the app automatically creates a default profile in Supabase using the user's Firebase details (email, displayName) and inserts it. This prevents the app from breaking if a database trigger fails or data is out of sync.

---

## Real-time & WebRTC

**Q10: How are "Online Status" and "Last Seen" features implemented?**
**A:** The app uses **Supabase Realtime Presence**. 
In `Appcontext`, the `setupPresence` function connects to a Supabase channel (`online-users`). When a user connects, their UID is tracked. The channel listens for `presence` sync events, updating a local `Set` of `onlineUsers`. This allows the UI to instantly show who is online. For "Last Seen", a database update is triggered to update the `lastseen` timestamp in the `users` table whenever the user logs in or their profile is loaded.

**Q11: How does the app update the chat list and unread counts in real-time without polling?**
**A:** It uses Supabase's `postgres_changes` listener. 
In `Appcontext`, a channel is subscribed to listen for any `UPDATE`, `INSERT`, or `DELETE` events on the `user_chats` table where the `owner_id` equals the current user's UID. Whenever a new message arrives, the backend updates the `user_chats` table, triggering this listener. The app then re-fetches the latest chat list and recalculates the `unreadChats` state dynamically, ensuring the UI is instantly updated without continuous HTTP polling.

**Q12: Explain how the calling feature (`Callcontext.jsx`) is architected.**
**A:** The calling feature uses **WebRTC** (Web Real-Time Communication) for peer-to-peer audio/video transmission.
- `CallContext` holds the `activeCall` state and uses `useRef` to maintain references to `peerConnections` (the WebRTC connections to other users) and the `localStream` (the user's own camera/microphone feed). 
- Using `useRef` is critical here because peer connections and media streams are mutable objects that do not need to trigger React re-renders when their internal states change, preventing performance issues during active video calls.
- When `endCall` is triggered, it iterates through the tracks in the `localStream` and stops them (turning off the camera/mic), closes all peer connections, clears the references, and resets the `activeCall` state. (Signaling for WebRTC is likely handled via Socket.io or Supabase Realtime).
