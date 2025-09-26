// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { toast } from "react-toastify";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD6YPmC67GJCm56l3iruSrYcJ_R35ftDQI",
  authDomain: "chat-app-gs-a4ed9.firebaseapp.com",
  projectId: "chat-app-gs-a4ed9",
  storageBucket: "chat-app-gs-a4ed9.firebasestorage.app",
  messagingSenderId: "1087493872577",
  appId: "1:1087493872577:web:9b4f08f66bcfc8589fad40"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Utility: ensure userChats doc exists
const ensureUserChatsDoc = async (uid) => {
  const ref = doc(db, "userChats", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { chatdata: [] });
  }
};

export const signup = async (username, email, password) => {
  try {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const user = res.user;

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      username: username.toLowerCase(),
      email,
      avatar: "",
      bio: "Hey there! I am using Chat App",
      online: true,
      lastseen: new Date().toLocaleString(),
    });

    await ensureUserChatsDoc(user.uid);
  } catch (error) {
    console.error(error);
    toast.error(error.code.split("/")[1].split("-").join(" "));
  }
};

export const Login = async (email, password) => {
  try {
    const res = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserChatsDoc(res.user.uid);
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
