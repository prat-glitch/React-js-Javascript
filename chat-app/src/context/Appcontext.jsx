import { createContext, useEffect, useMemo, useState, useRef, useCallback } from "react";
import { auth } from "../config/firebase";
import { setSupabaseToken, getSupabase } from "../config/supabase";
import { useNavigate, useLocation } from "react-router-dom";
import { isPushSupported, subscribeToPush, unsubscribeFromPush } from "../lib/pushNotifications";
import { getOrCreateKeyPair, exportPrivateKey } from "../lib/crypto";

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
  const [allUsers, setAllUsers] = useState([]);    // scoped: only active chat partners
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [unreadChats, setUnreadChats] = useState({}); // {recipientId: count}
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [e2eeReady, setE2eeReady] = useState(false); // true once key pair is initialised

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);


  const presenceChannelRef = useRef(null);
  const initializedRef = useRef(false); // guard: don't re-run setup on token refresh

  // ---------- Auth state & Token Exchange ----------
  // onIdTokenChanged fires on:
  //   1. Initial sign-in (any method — email, Google, etc.)
  //   2. Every time Firebase silently refreshes its token (~1 hour)
  //      → Supabase JWT is automatically refreshed too
  //   3. Sign-out (firebaseUser is null)
  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        try {
          // Always refresh the Supabase JWT whenever Firebase rotates the token
          const firebasetoken = await firebaseUser.getIdToken();
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-token`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ firebasetoken }),
            }
          );

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Token exchange failed: ${response.status} - ${errText}`);
          }

          const { supabasetoken } = await response.json();
          setSupabaseToken(supabasetoken); // recreates the authenticated Supabase client

          // Only run the one-time setup on first sign-in, not on every token refresh
          if (!initializedRef.current) {
            initializedRef.current = true;
            // ── E2EE: generate, retrieve or restore this user's ECDH key pair ──
            try {
              const profileData = await loaduserdata(firebaseUser.uid);
              setupPresence(firebaseUser.uid);

              const cloudPrivateKey = profileData?.private_key ?? null;
              const publicKeyJson = await getOrCreateKeyPair(firebaseUser.uid, cloudPrivateKey);
              
              // If cloud backup doesn't exist yet, save the new keys to Supabase
              if (!profileData?.private_key || !profileData?.public_key) {
                const privateKeyJwk = await exportPrivateKey(firebaseUser.uid);
                await getSupabase()
                  .from('users')
                  .update({ 
                    public_key: publicKeyJson,
                    private_key: privateKeyJwk ? JSON.stringify(privateKeyJwk) : null
                  })
                  .eq('uid', firebaseUser.uid);
              }
              setE2eeReady(true);
            } catch (cryptoErr) {
              console.warn('E2EE key init failed (Web Crypto not available?):', cryptoErr);
            }
          }

          // Register push notifications
          if (isPushSupported() && Notification.permission === 'granted') {
            subscribeToPush(firebaseUser.uid);
          }
        } catch (err) {
          console.error('Token exchange failed:', err);
        }
      } else {
        // Sign-out: reset everything
        initializedRef.current = false;
        setUser(null);
        setuserdata(null);
        setSelectedChatUser(null);
        if (presenceChannelRef.current) {
          presenceChannelRef.current.unsubscribe();
        }
        
        // Clean up push subscription
        if (userdata?.uid) {
          unsubscribeFromPush(userdata.uid);
        }
        
        if (location.pathname !== '/') navigate('/');
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
            avatar: fbUser.photoURL || '',   // Google users get their profile picture
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
      return finalData;
    } catch (err) {
      console.error("Error loading user data:", err);
      return null;
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

  // ---------- Realtime: scoped chat contacts (via RPC) ----------
  // Only fetches users who share an active user_chats row with the current user.
  // This replaces the previous global `users.select('*')` for privacy.
  const fetchChatContacts = useCallback(async (uid) => {
    if (!uid) return;
    const { data, error } = await getSupabase().rpc('get_chat_contacts', { p_uid: uid });
    if (!error && data) setAllUsers(data);
  }, []);

  useEffect(() => {
    if (!userdata?.uid) return;

    fetchChatContacts(userdata.uid);

    // Listen for changes on the users table (e.g., avatar updates, public_key upserts)
    const usersChannel = getSupabase()
      .channel('users_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchChatContacts(userdata.uid);
      })
      .subscribe();

    return () => usersChannel.unsubscribe();
  }, [userdata?.uid, fetchChatContacts]);

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
  const fetchChats = useCallback(async (uid) => {
    if (!uid) return;
    const { data } = await getSupabase()
      .from('user_chats')
      .select('*')
      .eq('owner_id', uid)
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

      // Re-fetch scoped contacts so newly started conversations
      // (e.g., via AddContactModal) appear immediately in allUsers.
      fetchChatContacts(uid);
    }
  }, [selectedChatUser?.uid, fetchChatContacts]);

  useEffect(() => {
    if (!userdata?.uid) return;

    fetchChats(userdata.uid);

    const channel = getSupabase()
      .channel('user_chats_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'user_chats', 
        filter: `owner_id=eq.${userdata.uid}` 
      }, () => {
        fetchChats(userdata.uid);
      })
      .subscribe();

    // Listen for new messages globally in AppContext to trigger recent chats / contacts refresh.
    // This provides a fallback trigger in case the user_chats publication is missing/delayed.
    const messagesChannel = getSupabase()
      .channel('global_messages_changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, (payload) => {
        const msg = payload.new;
        if (msg && msg.chat_id && msg.chat_id.includes(userdata.uid)) {
          fetchChats(userdata.uid);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      messagesChannel.unsubscribe();
    };
  }, [userdata?.uid, fetchChats]);

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
    theme,
    setTheme,
    e2eeReady,         // true once the ECDH key pair has been initialised
  }), [user, userdata, enrichedAllUsers, userChats, selectedChatUser, unreadChats, theme, e2eeReady]);

  return (
    <Appcontext.Provider value={value}>
      {props.children}
    </Appcontext.Provider>
  );
};

export default Appcontextprovider;
