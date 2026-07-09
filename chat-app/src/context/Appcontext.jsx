import { createContext, useEffect, useMemo, useState, useRef } from "react";
import { auth } from "../config/firebase";
import { setSupabaseToken, getSupabase } from "../config/supabase";
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
  const [unreadChats, setUnreadChats] = useState({}); // {recipientId: count}
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const presenceChannelRef = useRef(null);

  // ---------- Auth state & Token Exchange ----------
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        try {
          // Exchange Firebase token for Supabase JWT
          const firebasetoken = await firebaseUser.getIdToken();
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firebasetoken })
          });
          
          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Failed to fetch Supabase token: ${response.status} - ${errText}`);
          }
          const { supabasetoken } = await response.json();
          
          // Set it globally
          setSupabaseToken(supabasetoken);

          await loaduserdata(firebaseUser.uid);
          setupPresence(firebaseUser.uid);
        } catch (err) {
          console.error("Token exchange failed:", err);
        }

      } else {
        setUser(null);
        setuserdata(null);
        setSelectedChatUser(null);
        if (presenceChannelRef.current) {
          presenceChannelRef.current.unsubscribe();
        }
        if (location.pathname !== "/") navigate("/");
      }
    });

    return () => {
      unsubscribe();
      if (presenceChannelRef.current) presenceChannelRef.current.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Load profile ----------
  const loaduserdata = async (uid) => {
    try {
      const { data, error } = await getSupabase().from('users').select('*').eq('uid', uid).maybeSingle();

      if (error) throw error;
      
      let finalData = data;

      if (!finalData) {
        // Fallback: If user exists in Firebase but not Supabase, create their profile now!
        const fbUser = auth.currentUser;
        if (fbUser) {
          const newProfile = {
            uid: fbUser.uid,
            username: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            email: fbUser.email,
            avatar: "",
            bio: "Hey there! I am using Chat App",
            online: true,
            lastseen: new Date().toLocaleString(),
          };
          const { data: insertedData, error: insertErr } = await getSupabase().from('users').insert(newProfile).select().single();
          if (insertErr) {
            console.error("Failed to auto-create missing Supabase profile:", insertErr);
          } else {
            finalData = insertedData;
          }
        }
      }

      if (finalData) {
        setuserdata(finalData);
        
        // Route guard after profile load
        const profileCompleted = finalData.profile_completed;
        const currentPath = window.location.pathname;

        if (profileCompleted && currentPath !== "/chat") {
          navigate("/chat");
        } else if (!profileCompleted && currentPath !== "/profile") {
          navigate("/profile");
        }

        // Update lastseen heartbeat
        await getSupabase().from('users').update({
            lastseen: new Date().toLocaleString()
        }).eq('uid', uid);
      }
    } catch (err) {
      console.error("Error loading user data:", err);
    }
  };

  // ---------- Supabase Realtime Presence ----------
  const setupPresence = (uid) => {
    if (presenceChannelRef.current) {
      presenceChannelRef.current.unsubscribe();
    }

    const channel = getSupabase().channel('online-users', {
      config: { presence: { key: uid } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set(Object.keys(state));
        setOnlineUsers(onlineIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    presenceChannelRef.current = channel;
  };

  // ---------- Realtime: all users ----------
  useEffect(() => {
    if (!userdata?.uid) return;

    const fetchUsers = async () => {
      const { data } = await getSupabase().from('users').select('*');
      if (data) setAllUsers(data);
    };
    fetchUsers();

    const channel = getSupabase()
      .channel('users_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
        fetchUsers();
      })
      .subscribe();

    return () => channel.unsubscribe();
  }, [userdata?.uid]);

  // Keep selectedChatUser in sync with latest data + presence
  useEffect(() => {
    if (selectedChatUser && allUsers.length > 0) {
      const updatedUser = allUsers.find(u => u.uid === selectedChatUser.uid);
      if (updatedUser) {
        // Merge presence state
        updatedUser.online = onlineUsers.has(updatedUser.uid);
        setSelectedChatUser(updatedUser);
      }
    }
  }, [allUsers, onlineUsers]);

  // ---------- Realtime: my chat list ----------
  useEffect(() => {
    if (!userdata?.uid) return;

    const fetchChats = async () => {
      const { data } = await getSupabase()
        .from('user_chats')
        .select('*')
        .eq('owner_id', userdata.uid)
        .order('updated_at', { ascending: false });
        
      if (data) {
        setUserChats(data);
        
        const newUnread = {};
        data.forEach(chat => {
          if (chat.unread > 0 && chat.recipient_id !== selectedChatUser?.uid) {
            newUnread[chat.recipient_id] = chat.unread;
          }
        });
        setUnreadChats(newUnread);
      }
    };

    fetchChats();

    const channel = getSupabase()
      .channel('user_chats_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'user_chats', 
        filter: `owner_id=eq.${userdata.uid}` 
      }, () => {
        fetchChats();
      })
      .subscribe();

    return () => channel.unsubscribe();
  }, [userdata?.uid, selectedChatUser?.uid]);

  // Clear unread when selecting a chat
  const markChatAsRead = async (recipientId) => {
    if (!userdata?.uid || !recipientId) return;
    try {
      await getSupabase()
        .from('user_chats')
        .update({ unread: 0 })
        .eq('owner_id', userdata.uid)
        .eq('recipient_id', recipientId);
        
      setUnreadChats(prev => {
        const copy = { ...prev };
        delete copy[recipientId];
        return copy;
      });
    } catch (err) {
      console.error("Error marking chat as read:", err);
    }
  };

  // Helper to get user info for lists
  const enrichedAllUsers = useMemo(() => {
    return allUsers.map(u => ({
      ...u,
      online: onlineUsers.has(u.uid)
    }));
  }, [allUsers, onlineUsers]);

  const value = useMemo(() => ({
    user,
    userdata,
    allUsers: enrichedAllUsers,
    userChats,
    selectedChatUser,
    setSelectedChatUser,
    getChatId,
    loaduserdata,
    unreadChats,
    markChatAsRead,
  }), [user, userdata, enrichedAllUsers, userChats, selectedChatUser, unreadChats]);

  return (
    <Appcontext.Provider value={value}>
      {props.children}
    </Appcontext.Provider>
  );
};

export default Appcontextprovider;
