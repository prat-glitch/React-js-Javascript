import { initializeApp } from "firebase/app";
import { 
  createUserWithEmailAndPassword, 
  getAuth, 
  sendPasswordResetEmail, 
  signInWithEmailAndPassword, 
  signOut
} from "firebase/auth";
import { 
  collection, 
  doc, 
  getDocs, 
  getFirestore, 
  query, 
  setDoc, 
  where 
} from "firebase/firestore";
import { toast } from "react-toastify";

// --------- Firebase Config ---------
const firebaseConfig = {
  apiKey: "AIzaSyBYfHbRP_oIr7MC5YN2S1u3ZW9zEAPx240",
  authDomain: "chat-app-203ff.firebaseapp.com",
  projectId: "chat-app-203ff",
  storageBucket: "chat-app-203ff.firebasestorage.app",
  messagingSenderId: "112286281418",
  appId: "1:112286281418:web:f67917e05d80f3caeb8e33"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ----------------- SIGNUP -----------------
const signup = async (username, email, password) => {
  try {
    // check if username already exists
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      toast.error("Username already taken");
      return null;
    }

    // create user in Firebase Auth
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const user = res.user;
    console.log("UID at signup:", user.uid);

    // create user profile in Firestore
    await setDoc(doc(db, "users", user.uid), {
      id: user.uid,
      username: username.toLowerCase(),
      email,
      name: "",
      avatar: "",
      bio: "Hey, there! I am using chat app",
      lastSeen: Date.now(),
    });

    // initialize empty chat list for this user
    await setDoc(doc(db, "userChats", user.uid), {
      chatsData: [],
    });

    toast.success("Signup successful!");
    return user;

  } catch (error) {
    console.error("Signup Error:", error);
    const message = error?.code
      ? error.code.split("/")[1]?.replace(/-/g, " ") || "Unknown error"
      : error.message || "An error occurred";
    toast.error(message);
  }
};

// ----------------- LOGIN -----------------
const login = async (email, password) => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    toast.success("Login successful!");
  } catch (error) {
    console.error("Login Error:", error);
    const message = error?.code 
      ? error.code.split("/")[1].replace(/-/g, " ") 
      : error.message;
    toast.error(message);
  }
};

// ----------------- LOGOUT -----------------
const logout = () => {
  signOut(auth);
  toast.info("Logged out");
};

// ----------------- RESET PASSWORD -----------------
const resetPass = async (email) => {
  if (!email) {
    toast.error("Enter your email");
    return;
  }
  try {
    const userRef = collection(db, "users");
    const q = query(userRef, where("email", "==", email));
    const querySnap = await getDocs(q);

    if (!querySnap.empty) {
      await sendPasswordResetEmail(auth, email);
      toast.success("Reset Email Sent");
    } else {
      toast.error("Email doesn't exist");
    }
  } catch (error) {
    console.error("ResetPass Error:", error);
    toast.error(error.message);
  }
};

export { auth, db, signup, login, logout, resetPass };
