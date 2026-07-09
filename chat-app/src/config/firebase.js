// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { toast } from "react-toastify";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const signup = async (username, email, password) => {
  try {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const user = res.user;

    // Exchange token for Supabase JWT
    const firebasetoken = await user.getIdToken();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebasetoken })
    });
    
    if (response.ok) {
      const { supabasetoken } = await response.json();
      const { setSupabaseToken, getSupabase } = await import('./supabase.js');
      setSupabaseToken(supabasetoken);

      // Write user profile to Supabase
      await getSupabase().from('users').insert({
        uid: user.uid,
        username: username.toLowerCase(),
        email,
        avatar: "",
        bio: "Hey there! I am using Chat App",
        online: true,
        lastseen: new Date().toLocaleString(),
      });
      // Note: user_chats is inserted dynamically by trigger when messages are sent, 
      // so we don't need to manually initialize it on signup!
    }

    return true; // Success
  } catch (error) {
    console.error(error);
    toast.error(error.code?.split("/")[1]?.split("-").join(" ") || error.message);
    return false;
  }
};

export const Login = async (email, password) => {
  try {
    const res = await signInWithEmailAndPassword(auth, email, password);
    return res.user;
  } catch (error) {
    console.error(error);
    toast.error(error.code.split("/")[1].split("-").join(" "));
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    toast.error(error.code.split("/")[1].split("-").join(" "));
  }
};
