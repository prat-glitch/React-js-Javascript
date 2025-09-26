import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { createContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import ImageKit from "imagekit-javascript";

// ================================
// ✅ Setup ImageKit client (Correctly configured)
// ================================
const imagekit = new ImageKit({
  publicKey: "public_QNONAWZ6yKSuzoKyG1Ruo3u8cX8=", // from ImageKit dashboard
  urlEndpoint: "https://ik.imagekit.io/prat123",     // 🚀 REMOVE trailing slash
  authenticationEndpoint: "http://localhost:3001/auth", // backend auth endpoint
});

export const AppContext = createContext();

const AppContextProvider = (props) => {
  const [userData, setUserData] = useState(null);
  const [chatData, setChatData] = useState(null);
  const [messagesId, setMessagesId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const navigate = useNavigate();

  // 🔽 Upload image to ImageKit
  const uploadImage = async (file) => {
    if (!file) return null;
    try {
      const response = await imagekit.upload({
        file, // File object or base64 string
        fileName: file.name,
        folder: "/profiles", // optional: keep uploads organized
      });
      return response.url; // ✅ uploaded file URL
    } catch (error) {
      console.error("ImageKit Upload Error:", error);
      toast.error("Image upload failed. Try again!");
      return null;
    }
  };

  // 🔽 Load user data from Firestore
  const loadUserData = async (uid) => {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      setUserData(userData);

      if (userData.avatar && userData.name) {
        navigate("/chat");
      } else {
        navigate("/profile");
      }

      // update lastSeen immediately
      await updateDoc(userRef, { lastSeen: Date.now() });

      // keep updating lastSeen every 1 min
      setInterval(async () => {
        if (auth.currentUser) {
          await updateDoc(userRef, { lastSeen: Date.now() });
        }
      }, 60000);
    } catch (error) {
      toast.error(error.message);
    }
  };

  // 🔽 Realtime chat listener
  useEffect(() => {
    if (userData) {
      const chatRef = doc(db, "chats", userData.id);
      const unSub = onSnapshot(chatRef, async (res) => {
        const chatItems = res.data()?.chatsData || [];
        const tempData = [];

        for (const item of chatItems) {
          if (!item.rId) {
            console.error("Invalid rId in item:", item);
            continue; // Skip this item if rId is invalid
          }

          try {
            const userRef = doc(db, "users", item.rId);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();
            tempData.push({ ...item, userData });
          } catch (error) {
            console.error("Error fetching user data for rId:", item.rId, error);
          }
        }

        setChatData(tempData.sort((a, b) => b.updatedAt - a.updatedAt));
      });

      return () => unSub();
    }
  }, [userData]);

  // 🔽 Polling backup (every 10 sec)
  useEffect(() => {
    if (userData) {
      const interval = setInterval(async () => {
        const chatRef = doc(db, "chats", userData.id);
        const data = await getDoc(chatRef);
        const chatItems = data.data()?.chatsData || [];
        const tempData = [];

        for (const item of chatItems) {
          if (!item.rId) {
            console.error("Invalid rId in item:", item);
            continue; // Skip this item if rId is invalid
          }

          try {
            const userRef = doc(db, "users", item.rId);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();
            tempData.push({ ...item, userData });
          } catch (error) {
            console.error("Error fetching user data for rId:", item.rId, error);
          }
        }

        setChatData(tempData.sort((a, b) => b.updatedAt - a.updatedAt));
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [userData]);

  // ✅ Provide context values
  const value = {
    userData,
    setUserData,
    loadUserData,
    chatData,
    messagesId,
    setMessagesId,
    chatUser,
    setChatUser,
    chatVisible,
    setChatVisible,
    messages,
    setMessages,
    uploadImage, // ✅ Expose upload function
  };

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;