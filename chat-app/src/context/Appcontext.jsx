// src/context/Appcontext.jsx
import { createContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "../config/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  onSnapshot
} from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";

export const Appcontext = createContext();

const getChatId = (uid1, uid2) => {
  if (uid1 === uid2) return `${uid1}_${uid1}`; // self-chat for testing
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
};

const Appcontextprovider = (props) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [userdata, setuserdata] = useState(null);
  const [userChats, setUserChats] = useState([]); // recent chats list
  const [allUsers, setAllUsers] = useState([]);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [lastSeenIntervalId, setLastSeenIntervalId] = useState(null);

  // ---------- Auth state ----------
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await loaduserdata(firebaseUser.uid);

        // Route guard after profile load
        const userRef = doc(db, "users", firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        const data = userSnap.data();
        const profileCompleted = data?.avatar && data?.username;

        if (profileCompleted && location.pathname !== "/chat") {
          navigate("/chat");
        } else if (!profileCompleted && location.pathname !== "/profile") {
          navigate("/profile");
        }
      } else {
        setUser(null);
        setuserdata(null);
        setSelectedChatUser(null);
        if (location.pathname !== "/") navigate("/");
      }
    });

    return () => {
      if (lastSeenIntervalId) clearInterval(lastSeenIntervalId);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Presence + profile load ----------
  const loaduserdata = async (uid) => {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setuserdata({ uid, ...data });

        // mark online, update lastseen
        await updateDoc(userRef, {
          online: true,
          lastseen: new Date().toLocaleString(),
        });

        // on page close: set offline
        const onClose = async () => {
          try {
            await updateDoc(userRef, {
              online: false,
              lastseen: new Date().toLocaleString(),
            });
          } catch {}
        };
        window.addEventListener("beforeunload", onClose);

        // heartbeat: refresh lastseen every minute
        if (!lastSeenIntervalId) {
          const id = setInterval(async () => {
            const currentUser = auth.currentUser;
            if (currentUser) {
              await updateDoc(doc(db, "users", currentUser.uid), {
                lastseen: new Date().toLocaleString(),
              });
            }
          }, 60000);
          setLastSeenIntervalId(id);
        }
      }
    } catch (err) {
      console.error("Error loading user data:", err);
    }
  };

  // ---------- Realtime: all users ----------
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      setAllUsers(users);
    });
    return () => unsub();
  }, []);

  // ---------- Realtime: my chat list (userChats/{uid}) ----------
  useEffect(() => {
    if (!userdata?.uid) return;
    const unsub = onSnapshot(doc(db, "userChats", userdata.uid), (snap) => {
      const list = snap.data()?.chatdata || [];
      // sort desc by updatedAt numeric
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setUserChats(list);
    }, (err) => {
      console.error("userChats listener error:", err);
    });
    return () => unsub();
  }, [userdata?.uid]);

  const value = useMemo(() => ({
    user,
    userdata,
    allUsers,
    userChats,
    selectedChatUser,
    setSelectedChatUser,
    getChatId,
  }), [user, userdata, allUsers, userChats, selectedChatUser]);

  return (
    <Appcontext.Provider value={value}>
      {props.children}
    </Appcontext.Provider>
  );
};

export default Appcontextprovider;
