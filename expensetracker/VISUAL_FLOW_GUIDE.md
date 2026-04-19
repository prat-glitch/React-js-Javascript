# Google OAuth Authentication - Visual Guide

## 🔄 Complete Authentication Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                        🎯 USER AUTHENTICATION FLOW                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘


Step 1: USER ARRIVES
════════════════════
     👤 User
      │
      │ Opens browser
      ▼
┌─────────────────────┐
│  http://localhost:  │
│        5173         │
│                     │
│  [Login Page]       │
│                     │
│  ┌───────────────┐  │
│  │ Sign in with  │  │  ← User sees this button
│  │    Google     │  │
│  └───────────────┘  │
└─────────────────────┘


Step 2: USER CLICKS GOOGLE BUTTON
════════════════════════════════
     👤 User
      │
      │ Clicks "Sign in with Google"
      ▼
┌─────────────────────────────────────┐
│   Google OAuth Popup Opens          │
│                                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃  Choose an account          ┃   │
│  ┃                              ┃   │
│  ┃  ○ john@gmail.com           ┃   │
│  ┃    John Doe                  ┃   │
│  ┃                              ┃   │
│  ┃  ○ jane@gmail.com           ┃   │
│  ┃    Jane Smith                ┃   │
│  ┃                              ┃   │
│  ┃  [Use another account]       ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
└─────────────────────────────────────┘
      │
      │ User selects account & authorizes
      ▼


Step 3: GOOGLE GENERATES TOKEN
═══════════════════════════════
┌─────────────────────────────────┐
│    🔐 Google Servers            │
│                                 │
│  1. Verifies user identity      │
│  2. Generates ID Token (JWT)    │
│  3. Returns to frontend         │
│                                 │
│  Token contains:                │
│  • sub (Google ID)              │
│  • email                        │
│  • name                         │
│  • picture (avatar URL)         │
└─────────────────────────────────┘
      │
      │ Returns credential
      ▼


Step 4: FRONTEND RECEIVES CREDENTIAL
═════════════════════════════════════
┌─────────────────────────────────────────┐
│  📱 React Frontend (localhost:5173)     │
│                                         │
│  Auth.jsx Component                     │
│  ├─ GoogleLogin component               │
│  └─ handleGoogleLogin()                 │
│      │                                   │
│      │ Receives:                         │
│      │ { credential: "eyJhbGc..." }      │
│      │                                   │
│      │ Sends to backend:                │
│      └─ POST /api/users/google-auth     │
└─────────────────────────────────────────┘
      │
      │ HTTP POST Request
      │ { credential: "token..." }
      ▼


Step 5: BACKEND VERIFIES TOKEN
═══════════════════════════════
┌──────────────────────────────────────────────┐
│  ⚙️ Express Backend (localhost:3000)         │
│                                              │
│  userController.js → googleAuth()            │
│  ┌──────────────────────────────────┐       │
│  │ 1. Receive credential from       │       │
│  │    frontend                      │       │
│  │                                  │       │
│  │ 2. Verify with Google:           │       │
│  │    googleClient.verifyIdToken()  │◄──────┼─── Calls Google
│  │                                  │       │    to verify token
│  │ 3. Extract user data:            │       │
│  │    • googleId (sub)              │       │
│  │    • email                       │       │
│  │    • name                        │       │
│  │    • picture                     │       │
│  │                                  │       │
│  │ 4. Check if user exists          │       │
│  │    in database                   │       │
│  └──────────────────────────────────┘       │
└──────────────────────────────────────────────┘
      │
      ▼


Step 6: DATABASE OPERATION
═══════════════════════════
┌─────────────────────────────────────┐
│  🗄️ MongoDB Database                │
│                                     │
│  IF user exists:                    │
│  ├─ Find by email                   │
│  └─ Update googleId if needed       │
│                                     │
│  IF user doesn't exist:             │
│  ├─ Create new user document        │
│  │  {                               │
│  │    name: "John Doe",             │
│  │    email: "john@gmail.com",      │
│  │    googleId: "123456",           │
│  │    avatar: "pic.jpg",            │
│  │    authProvider: "google"        │
│  │  }                               │
│  └─ Save to database                │
└─────────────────────────────────────┘
      │
      ▼


Step 7: GENERATE APP JWT TOKEN
═══════════════════════════════
┌─────────────────────────────────────┐
│  ⚙️ Backend Token Generation        │
│                                     │
│  generateToken(userId)              │
│  ├─ Creates JWT with user ID        │
│  ├─ Signs with JWT_SECRET           │
│  └─ Sets expiry: 30 days            │
│                                     │
│  Token payload:                     │
│  {                                  │
│    id: "user_mongodb_id",           │
│    iat: timestamp,                  │
│    exp: timestamp + 30 days         │
│  }                                  │
└─────────────────────────────────────┘
      │
      │ Returns to frontend
      ▼


Step 8: FRONTEND STORES DATA
═════════════════════════════
┌─────────────────────────────────────────┐
│  📱 React Frontend                      │
│                                         │
│  Response received:                     │
│  {                                      │
│    token: "jwt_token",                  │
│    user: {                              │
│      id: "123",                         │
│      name: "John Doe",                  │
│      email: "john@gmail.com",           │
│      avatar: "pic.jpg"                  │
│    }                                    │
│  }                                      │
│                                         │
│  Storage:                               │
│  ├─ localStorage.setItem(              │
│  │    "expense_track_token", token     │
│  │  )                                   │
│  └─ localStorage.setItem(              │
│       "expense_track_user", user       │
│     )                                   │
│                                         │
│  AuthContext:                           │
│  ├─ setIsAuthenticated(true)           │
│  └─ setCurrentUser(user)                │
└─────────────────────────────────────────┘
      │
      │ Redirect to dashboard
      ▼


Step 9: USER LOGGED IN
══════════════════════
┌─────────────────────────────────────┐
│  🎉 Dashboard Page                  │
│                                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃  👤 Welcome, John Doe!       ┃  │
│  ┃                              ┃  │
│  ┃  📊 Your Transactions        ┃  │
│  ┃  💰 Budget Overview          ┃  │
│  ┃  📈 Analytics                ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                     │
│  All API requests now include:      │
│  Authorization: Bearer jwt_token    │
└─────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════


## 🔒 Security Flow

┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  1. Google Verifies:  User's identity with Google account         │
│     ✓ Password checked by Google                                  │
│     ✓ 2FA if enabled                                              │
│     ✓ Suspicious activity detection                               │
│                                                                    │
│  2. Google Issues:    Signed JWT token (ID Token)                 │
│     ✓ Contains user info                                          │
│     ✓ Cryptographically signed                                    │
│     ✓ Short expiry time                                           │
│                                                                    │
│  3. Backend Verifies: Token authenticity with Google              │
│     ✓ Validates signature                                         │
│     ✓ Checks expiration                                           │
│     ✓ Verifies audience (Client ID)                               │
│                                                                    │
│  4. Backend Creates:  App-specific JWT token                      │
│     ✓ Signed with JWT_SECRET                                      │
│     ✓ 30-day expiry                                               │
│     ✓ Contains only user ID                                       │
│                                                                    │
│  5. Frontend Uses:    App JWT for all API requests                │
│     ✓ Stored securely in localStorage                             │
│     ✓ Sent in Authorization header                                │
│     ✓ Validated on each request                                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════


## 📦 Component Breakdown

FRONTEND (React)
================
┌──────────────────────────────────────────┐
│  main.jsx                                │
│  └─ <GoogleOAuthProvider>               │
│      │                                   │
│      └─ <AuthProvider>                  │
│          │                               │
│          └─ <App>                        │
│              │                           │
│              └─ <Auth>                   │
│                  │                       │
│                  └─ <GoogleLogin />      │
│                      │                   │
│                      └─ onSuccess={      │
│                            handleGoogle  │
│                            Login         │
│                          }               │
└──────────────────────────────────────────┘

BACKEND (Express)
=================
┌──────────────────────────────────────────┐
│  app.js                                  │
│  └─ /api/users routes                   │
│      │                                   │
│      └─ userRoutes.js                    │
│          │                               │
│          └─ POST /google-auth            │
│              │                           │
│              └─ userController.js        │
│                  │                       │
│                  └─ googleAuth()         │
│                      │                   │
│                      ├─ Verify token     │
│                      ├─ Find/create user │
│                      └─ Generate JWT     │
└──────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════


## 🎯 Key Configuration Points

GOOGLE CLOUD CONSOLE
=====================
• Project: Expense Tracker
• OAuth Client ID: Web application
• Authorized JavaScript origins:
  ├─ http://localhost:5173
  └─ http://localhost:3000
• Authorized redirect URIs:
  └─ http://localhost:5173

BACKEND (.env)
==============
• GOOGLE_CLIENT_ID     → From Google Cloud Console
• GOOGLE_CLIENT_SECRET → From Google Cloud Console
• JWT_SECRET           → Your secure random string
• MONGO_URI            → MongoDB connection
• FRONTEND_URL         → http://localhost:5173

FRONTEND (.env)
===============
• VITE_GOOGLE_CLIENT_ID → Same as backend's GOOGLE_CLIENT_ID
• VITE_API_URL          → http://localhost:3000/api


═══════════════════════════════════════════════════════════════════════════


## ✅ Success Indicators

You know it's working when:

✓ Google button appears on login page
✓ Clicking button opens Google popup (not redirecting to error)
✓ After selecting account, popup closes
✓ User is redirected to dashboard
✓ User's name and email display correctly
✓ No errors in browser console
✓ No errors in backend terminal
✓ Database shows new user document
✓ localStorage contains token and user data
✓ Subsequent page reloads keep user logged in


═══════════════════════════════════════════════════════════════════════════


## 🔧 Debug Checklist

If something doesn't work:

□ Check GOOGLE_CLIENT_ID is same in both .env files
□ Restart both frontend and backend after .env changes
□ Open browser console (F12) and check for errors
□ Check backend terminal for error messages
□ Verify authorized origins in Google Cloud Console
□ Try with incognito/private window
□ Clear localStorage and cookies
□ Try with different Google account
□ Check internet connection (needs to reach Google)


═══════════════════════════════════════════════════════════════════════════
