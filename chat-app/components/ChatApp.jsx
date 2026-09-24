'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { normalizePhone, normalizeMessage } from '../lib/chat-utils';
import { disablePush, enablePush, pushSupported, restorePush, testPush } from '../lib/push-client';
import { playNotificationSound, unlockNotificationSound } from '../lib/notification-sound';

const time = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const initials = (name) => (name || '?').trim().slice(0, 1).toUpperCase();

export default function ChatApp() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(true);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [phone, setPhone] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const activeRef = useRef(null);
  const endRef = useRef(null);
  const unreadRef = useRef(null);
  const activeMessageIdsRef = useRef({ chatId: null, ids: null });
  const user = session?.user;
  const userId = user?.id;
  const active = chats.find((chat) => chat.chat_id === activeId);

  useEffect(() => {
    window.addEventListener('pointerdown', unlockNotificationSound);
    window.addEventListener('keydown', unlockNotificationSound);
    return () => {
      window.removeEventListener('pointerdown', unlockNotificationSound);
      window.removeEventListener('keydown', unlockNotificationSound);
    };
  }, []);

  useEffect(() => {
    const db = getSupabase();
    fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/settings', {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    }).then((response) => response.json()).then((settings) => {
      if (settings.external?.google === false) setGoogleReady(false);
      setConfirmationRequired(settings.mailer_autoconfirm === false);
    }).catch(() => {});
    db.auth.getSession().then(({ data, error }) => {
      if (error) setNotice(error.message);
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    unreadRef.current = null;
    activeMessageIdsRef.current = { chatId: null, ids: null };
  }, [userId]);

  useEffect(() => {
    if (!user) {
      setProfileReady(false);
      setChats([]);
      setActiveId(null);
      setMessages([]);
      return;
    }
    let live = true;
    const db = getSupabase();
    const name = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    db.from('basic_profiles').upsert({
      id: user.id,
      email: user.email,
      display_name: name,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' }).select('phone').single().then(({ data, error }) => {
      if (!live) return;
      if (error) {
        setNotice('Could not load your profile: ' + error.message);
        setProfileReady(false);
      } else {
        setPhone(data?.phone || '');
        setProfileReady(true);
      }
    });
    return () => { live = false; };
  }, [user]);

  useEffect(() => {
    if (!userId) { setPushEnabled(false); return; }
    let live = true;
    restorePush().then((enabled) => { if (live) setPushEnabled(enabled); })
      .catch(() => {
        if (live) {
          setPushEnabled(false);
          setNotice('Notifications need to be enabled again on this device.');
        }
      });
    return () => { live = false; };
  }, [userId]);

  const refreshChats = useCallback(async () => {
    if (!profileReady) return;
    const { data, error } = await getSupabase().rpc('list_basic_chats');
    if (error) { setNotice(error.message); return; }
    const previous = unreadRef.current;
    if (previous && document.visibilityState === 'visible' && (data || []).some((chat) =>
      chat.chat_id !== activeRef.current && Number(chat.unread_count) > (previous.get(chat.chat_id) || 0))) {
      playNotificationSound();
      setNotice('New message in Samlap.');
    }
    unreadRef.current = new Map((data || []).map((chat) => [chat.chat_id, Number(chat.unread_count)]));
    setChats(data || []);
  }, [profileReady]);

  const loadMessages = useCallback(async (chatId, full = false) => {
    if (!chatId) return;
    const db = getSupabase();
    if (full) setChatLoading(true);
    let rows = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await db.from('basic_messages')
        .select('id,chat_id,sender_id,body,created_at,read_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + 499);
      if (error) {
        setNotice('Could not load messages: ' + error.message);
        break;
      }
      rows = rows.concat(data || []);
      offset += (data || []).length;
      hasMore = Boolean(data && data.length === 500);
    }
    if (activeRef.current === chatId) {
      const seen = activeMessageIdsRef.current;
      if (seen.chatId === chatId && seen.ids && document.visibilityState === 'visible' &&
          rows.some((message) => message.sender_id !== user.id && !seen.ids.has(message.id))) {
        playNotificationSound();
      }
      activeMessageIdsRef.current = { chatId, ids: new Set(rows.map((message) => message.id)) };
      setMessages(rows);
    }
    if (full) setChatLoading(false);
    if (activeRef.current === chatId && document.visibilityState === 'visible') {
      const { error } = await db.rpc('mark_basic_chat_read', { p_chat_id: chatId });
      if (error) setNotice(error.message);
    }
    refreshChats();
  }, [refreshChats, user?.id]);

  useEffect(() => {
    activeRef.current = activeId;
    activeMessageIdsRef.current = { chatId: activeId, ids: null };
    setMessages([]);
    if (activeId) loadMessages(activeId, true);
  }, [activeId, loadMessages]);

  useEffect(() => {
    if (!profileReady) return;
    refreshChats();
    const db = getSupabase();
    const channel = db.channel('basic-chat-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'basic_messages' }, (event) => {
        refreshChats();
        if (event.new?.chat_id === activeRef.current) loadMessages(activeRef.current);
      }).subscribe();
    const poll = setInterval(() => {
      refreshChats();
      if (activeRef.current) loadMessages(activeRef.current);
    }, 10000);
    const focus = () => {
      refreshChats();
      if (activeRef.current) loadMessages(activeRef.current);
    };
    window.addEventListener('focus', focus);
    return () => {
      clearInterval(poll);
      window.removeEventListener('focus', focus);
      db.removeChannel(channel);
    };
  }, [profileReady, user?.id, refreshChats, loadMessages]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, activeId]);

  useEffect(() => {
    if (!chats.length) return;
    const requested = new URLSearchParams(window.location.search).get('chat');
    if (requested && chats.some((chat) => chat.chat_id === requested)) {
      setActiveId(requested);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [chats]);

  async function submitAuth(event) {
    event.preventDefault();
    setNotice('');
    setAuthBusy(true);
    const db = getSupabase();
    const email = authForm.email.trim().toLowerCase();
    let result;
    if (authMode === 'signup') {
      result = await db.auth.signUp({
        email, password: authForm.password,
        options: { data: { display_name: authForm.name.trim() } },
      });
    } else {
      result = await db.auth.signInWithPassword({ email, password: authForm.password });
    }
    if (result.error) {
      const rateLimited = /rate limit|too many|email.*exceeded/i.test(result.error.message);
      setNotice(rateLimited
        ? 'Supabase has reached its email limit. An admin must turn off Confirm Email in Supabase Authentication → Providers → Email, or wait for the limit to reset.'
        : result.error.message);
    } else if (authMode === 'signup' && !result.data.session) {
      setNotice('Account created, but this Supabase project still requires an email confirmation before sign-in.');
    }
    setAuthBusy(false);
  }

  async function googleLogin() {
    setNotice('');
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setNotice(error.message);
  }

  async function findUser(event) {
    event.preventDefault();
    if (!search.trim()) return;
    setSearchBusy(true);
    setSearchResult(null);
    setNotice('');
    const { data, error } = await getSupabase().rpc('find_basic_user', { p_identifier: search.trim() });
    if (error) setNotice(error.message);
    else if (data?.length) setSearchResult(data[0]);
    else setNotice('No account found. The person needs to sign up in this new app first.');
    setSearchBusy(false);
  }

  async function openNewChat(person) {
    const { data, error } = await getSupabase().rpc('create_basic_chat', { p_other: person.id });
    if (error) { setNotice(error.message); return; }
    setSearch('');
    setSearchResult(null);
    await refreshChats();
    setActiveId(data);
  }

  async function send(event) {
    event.preventDefault();
    const body = normalizeMessage(draft);
    if (!activeId || !body || sending) return;
    setSending(true);
    setNotice('');
    const { error } = await getSupabase().from('basic_messages').insert({
      chat_id: activeId, sender_id: user.id, body,
    });
    if (error) setNotice('Message not sent: ' + error.message);
    else {
      setDraft('');
      await loadMessages(activeId);
      refreshChats();
    }
    setSending(false);
  }

  async function savePhone(event) {
    event.preventDefault();
    const value = normalizePhone(phone);
    const { error } = await getSupabase().from('basic_profiles')
      .update({ phone: value || null, updated_at: new Date().toISOString() }).eq('id', user.id);
    if (error) setNotice(error.message);
    else { setPhone(value); setSettingsOpen(false); setNotice('Phone number saved. Others can now find you by this number.'); }
  }

  async function togglePush() {
    setPushBusy(true);
    setNotice('');
    try {
      if (pushEnabled) {
        await disablePush();
        setPushEnabled(false);
        setNotice('Notifications disabled on this device.');
      } else {
        await enablePush();
        setPushEnabled(true);
        setNotice('Notifications enabled on this device.');
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPushBusy(false);
    }
  }

  async function sendTestNotification() {
    setPushBusy(true);
    setNotice('');
    try {
      await testPush();
      setNotice('Test notification sent. Check this device’s notifications.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPushBusy(false);
    }
  }

  async function signOut() {
    try {
      await disablePush();
      await getSupabase().auth.signOut();
    } catch (error) {
      setNotice('Could not safely turn off notifications: ' + error.message);
    }
  }

  if (loading) return <main className="loading-screen">Opening Samlap…</main>;

  if (!session) return <main className="auth-shell">
    <section className="auth-intro">
      <div className="brand"><span className="brand-mark">✦</span> Samlap</div>
      <h1>Good conversations, kept simple.</h1>
      <p>Find someone by email or phone, then talk. Your messages stay in your account until you choose otherwise.</p>
      <div className="auth-art"><span>Hey! 👋</span><span>Good to hear from you ☀️</span><span>See you soon!</span></div>
    </section>
    <section className="auth-card">
      <h2>{authMode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
      <p>{authMode === 'signup' ? 'Start a fresh chat in a minute.' : 'Sign in to continue your conversations.'}</p>
      <form onSubmit={submitAuth}>
        {authMode === 'signup' && <label>Your name<input required value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Alex" /></label>}
        <label>Email<input required type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" /></label>
        <label>Password<input required type="password" minLength={6} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 6 characters" /></label>
        <button className="primary" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'}</button>
      </form>
      <div className="divider">or</div>
      {confirmationRequired && <p className="provider-note">Email confirmation is currently required by Supabase. New accounts may hit its email rate limit until Confirm Email is disabled.</p>}
      <button className="google" onClick={googleLogin} disabled={!googleReady}>Continue with Google</button>
      {!googleReady && <p className="provider-note">Google sign-in must be enabled in this Supabase project first.</p>}
      <button className="switch" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setNotice(''); }}>
        {authMode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
      </button>
      {notice && <p className="notice" role="alert">{notice}</p>}
    </section>
  </main>;

  return <main className="app-shell">
    <aside className={'sidebar ' + (activeId ? 'mobile-hidden' : '')}>
      <header className="sidebar-header">
        <div className="brand"><span className="brand-mark">✦</span> Samlap</div>
        <button className="icon-button" title="Settings" onClick={() => setSettingsOpen(!settingsOpen)}>⚙</button>
      </header>
      {settingsOpen && <form className="settings" onSubmit={savePhone}>
        <strong>{user.user_metadata?.display_name || user.email}</strong>
        <label>Phone number for search<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1234567890" /></label>
        <button className="small-primary">Save</button>
        <button type="button" className="small-primary" onClick={togglePush}
          disabled={pushBusy || !pushSupported() || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}>
          {pushBusy ? 'Please wait…' : pushEnabled ? 'Disable notifications' : 'Enable notifications'}
        </button>
        <button type="button" className="small-primary" onClick={sendTestNotification} disabled={!pushEnabled || pushBusy}>Send test notification</button>
        <button type="button" className="text-button" onClick={playNotificationSound}>Test sound</button>
        {!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && <small>Push setup is not complete yet.</small>}
        {!pushSupported() && <small>Push needs HTTPS and a supported browser. On iPhone, open Samlap in Safari, tap Share → Add to Home Screen, then launch the Home Screen app and enable notifications there.</small>}
        <button type="button" className="text-button" onClick={signOut}>Sign out</button>
      </form>}
      <form className="search-box" onSubmit={findUser}>
        <input aria-label="Find by email or phone" value={search} onChange={(e) => { setSearch(e.target.value); setSearchResult(null); }} placeholder="Find by email or phone" />
        <button disabled={searchBusy} title="Search">⌕</button>
      </form>
      {searchResult && <button className="search-result" onClick={() => openNewChat(searchResult)}>
        <span className="avatar">{initials(searchResult.display_name)}</span><span><strong>{searchResult.display_name}</strong><small>{searchResult.email}</small></span><b>Start chat →</b>
      </button>}
      <div className="section-title">Messages <span>{chats.length}</span></div>
      <div className="chat-list">
        {chats.map((chat) => <button key={chat.chat_id} className={'chat-item ' + (chat.chat_id === activeId ? 'selected' : '')} onClick={() => setActiveId(chat.chat_id)}>
          <span className="avatar">{initials(chat.peer_name)}</span>
          <span className="chat-item-main"><strong>{chat.peer_name}</strong><small>{chat.last_body || 'Start your conversation'}</small></span>
          <span className="chat-meta"><time>{time(chat.last_at)}</time>{Number(chat.unread_count) > 0 && <b>{chat.unread_count}</b>}</span>
        </button>)}
        {profileReady && chats.length === 0 && <p className="empty-list">No chats yet. Search for another Samlap account by email or phone, then tap Start chat.</p>}
        {!profileReady && <p className="empty-list">Preparing your account…</p>}
      </div>
      <footer className="sidebar-footer">{user.email}</footer>
    </aside>
    <section className={'conversation ' + (!activeId ? 'mobile-hidden' : '')}>
      {active ? <>
        <header className="conversation-header">
          <button className="back-button" onClick={() => setActiveId(null)} aria-label="Back to chats">←</button>
          <span className="avatar">{initials(active.peer_name)}</span>
          <div><strong>{active.peer_name}</strong><small>{active.peer_email}</small></div>
        </header>
        <div className="message-list">
          {chatLoading && <p className="messages-note">Loading messages…</p>}
          {!chatLoading && messages.length === 0 && <p className="messages-note">Say hello to {active.peer_name} 👋</p>}
          {messages.map((message) => <div key={message.id} className={'message-row ' + (message.sender_id === user.id ? 'mine' : '')}>
            <div className="bubble"><span>{message.body}</span><small>{time(message.created_at)} {message.sender_id === user.id ? (message.read_at ? '✓✓' : '✓') : ''}</small></div>
          </div>)}
          <div ref={endRef} />
        </div>
        <form className="composer" onSubmit={send}>
          <input aria-label="Message" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" maxLength={10000} />
          <button disabled={!draft.trim() || sending} title="Send message">➤</button>
        </form>
      </> : <div className="welcome"><div className="welcome-sun">✦</div><h2>Start a conversation.</h2><p>Search for another Samlap user by email or phone, choose Start chat, then send your first message.</p></div>}
    </section>
    {notice && session && <div className="toast" role="alert">{notice}<button onClick={() => setNotice('')}>×</button></div>}
  </main>;
}
