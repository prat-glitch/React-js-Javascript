'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTransientMessage } from '../lib/useTransientMessage';
import { useSpaceTaskNotifications } from '../lib/useSpaceTaskNotifications';
import { getSupabase } from '../lib/supabase';
import { normalizePhone, normalizeMessage } from '../lib/chat-utils';
import { isEmojiOnly, messagePreview, parseGifMessage } from '../lib/message-content';
import MessageComposer from './MessageComposer';
import TypingIndicator from './TypingIndicator';
import { useConversationTyping } from '../lib/useConversationTyping';
import ProfileConnections from './ProfileConnections';
import SpaceList from './SpaceList';
import SpaceConversation from './SpaceConversation';
import { validDisplayName, validPrivatePhone } from '../lib/profile-links';
import { ThemeToggle } from './ThemeProvider';
import { disablePush, enablePush, pushSupported, restorePush } from '../lib/push-client';
import { playNotificationSound, unlockNotificationSound } from '../lib/notification-sound';
import { createIncomingTracker, noticeLoadedMessages, noticeRealtimeMessage } from '../lib/incoming-alerts';

const time = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const initials = (name) => (name || '?').trim().slice(0, 1).toUpperCase();

export default function ChatApp({ inviteToken = null }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(true);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeSpaceId, setActiveSpaceId] = useState(null);
  const [spaceEntry, setSpaceEntry] = useState({ view: 'chat', taskId: null, key: 0 });
  const [spaceRevision, setSpaceRevision] = useState(0);
  const [messages, setMessages] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [phone, setPhone] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useTransientMessage();
  const [chatLoading, setChatLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const activeRef = useRef(null);
  const messageListRef = useRef(null);
  const followMessagesRef = useRef(true);
  const unreadRef = useRef(null);
  const incomingRef = useRef(createIncomingTracker());
  const pollErrorsRef = useRef({});
  const user = session?.user;
  const userId = user?.id;
  const taskAlerts = useSpaceTaskNotifications(userId, profileReady);
  const active = chats.find((chat) => chat.chat_id === activeId);
  const { typingUserIds, onTypingChange } = useConversationTyping({
    conversationId: activeId, kind: 'chat', userId,
    enabled: profileReady && Boolean(active) && !activeSpaceId && !settingsOpen,
  });

  // Polling reports each failure once, until recovery or a different failure.
  const reportPollingFailure = useCallback((source, message) => {
    if (pollErrorsRef.current[source] === message) return;
    pollErrorsRef.current[source] = message;
    if (message) setNotice(message);
  }, [setNotice]);

  useEffect(() => {
    if (!userId || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const resize = () => {
      if (viewport.scale === 1) document.documentElement.style.setProperty('--chat-viewport-height', viewport.height + 'px');
    };
    resize();
    viewport.addEventListener('resize', resize);
    return () => {
      viewport.removeEventListener('resize', resize);
      document.documentElement.style.removeProperty('--chat-viewport-height');
    };
  }, [userId]);

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
  }, [setNotice]);

  useEffect(() => {
    unreadRef.current = null;
    incomingRef.current = createIncomingTracker();
    pollErrorsRef.current = {};
  }, [userId]);

  useEffect(() => {
    if (!user) {
      setProfileReady(false);
      setProfile(null);
      setChats([]);
      setActiveId(null);
      setActiveSpaceId(null);
      setMessages([]);
      return;
    }
    let live = true;
    const db = getSupabase();
    db.rpc('ensure_basic_profile').then(({ data, error }) => {
      if (!live) return;
      if (error) {
        setNotice('Could not load your profile: ' + error.message);
        setProfileReady(false);
      } else {
        setProfile(data);
        setProfileName(data.display_name);
        setPhone(data?.phone || '');
        setProfileReady(true);
        if (!validPrivatePhone(data?.phone)) setSettingsOpen(true);
      }
    });
    return () => { live = false; };
  }, [user, setNotice]);

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
  }, [userId, setNotice]);

  const refreshChats = useCallback(async () => {
    if (!profileReady) return;
    const { data, error } = await getSupabase().rpc('list_basic_chats');
    reportPollingFailure('chats', error?.message || '');
    if (error) return;
    const previous = unreadRef.current;
    if (previous && document.visibilityState === 'visible' && (data || []).some((chat) =>
      chat.chat_id !== activeRef.current && Number(chat.unread_count) > (previous.get(chat.chat_id) || 0))) {
      playNotificationSound();
      setNotice('New message in Samlap.');
    }
    unreadRef.current = new Map((data || []).map((chat) => [chat.chat_id, Number(chat.unread_count)]));
    setChats(data || []);
  }, [profileReady, reportPollingFailure, setNotice]);

  const openConnectedChat = useCallback(async (chatId) => {
    await refreshChats();
    setActiveSpaceId(null);
    setActiveId(chatId);
  }, [refreshChats]);

  const updateSpaces = useCallback(() => setSpaceRevision((value) => value + 1), []);
  const openSpace = useCallback((spaceId, view = 'chat', taskId = null) => {
    setActiveId(null); setActiveSpaceId(spaceId);
    setSpaceEntry((current) => ({ view: view === 'tasks' ? 'tasks' : 'chat', taskId, key: current.key + 1 }));
  }, []);
  const closeSpace = useCallback(() => { setActiveSpaceId(null); setSpaceRevision((value) => value + 1); }, []);

  useEffect(() => {
    if (!profileReady) return;
    const query = new URLSearchParams(window.location.search);
    const requested = query.get('space');
    if (requested && /^[0-9a-f-]{36}$/i.test(requested)) {
      const task = query.get('task');
      openSpace(requested, query.get('view'), task && /^[0-9a-f-]{36}$/i.test(task) ? task : null);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [profileReady, openSpace]);

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
        reportPollingFailure('messages', 'Could not load messages: ' + error.message);
        if (full) setChatLoading(false);
        return;
      }
      rows = rows.concat(data || []);
      offset += (data || []).length;
      hasMore = Boolean(data && data.length === 500);
    }
    reportPollingFailure('messages', '');
    if (activeRef.current === chatId) {
      const newIncoming = noticeLoadedMessages(incomingRef.current, rows, user.id);
      if (newIncoming && document.visibilityState === 'visible') playNotificationSound();
      setMessages(rows);
    }
    if (full) setChatLoading(false);
    if (activeRef.current === chatId && document.visibilityState === 'visible') {
      const { error } = await db.rpc('mark_basic_chat_read', { p_chat_id: chatId });
      reportPollingFailure('read', error?.message || '');
    }
    refreshChats();
  }, [refreshChats, user?.id, reportPollingFailure]);

  const checkRecentMessages = useCallback(async () => {
    const chatId = activeRef.current;
    const tracker = incomingRef.current;
    if (!chatId || document.visibilityState !== 'visible' || tracker.chatId !== chatId || !tracker.knownIds) return;
    const { data, error } = await getSupabase().from('basic_messages')
      .select('id,chat_id,sender_id')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(20);
    if (error || activeRef.current !== chatId) return;
    let changed = false;
    let shouldSound = false;
    for (const message of (data || []).reverse()) {
      if (!tracker.knownIds.has(message.id)) {
        changed = true;
        if (noticeRealtimeMessage(tracker, message, userId)) shouldSound = true;
      }
    }
    if (shouldSound) playNotificationSound();
    if (changed) loadMessages(chatId);
  }, [loadMessages, userId]);

  useEffect(() => {
    activeRef.current = activeId;
    followMessagesRef.current = true;
    incomingRef.current = createIncomingTracker(activeId);
    setMessages([]);
    if (activeId) loadMessages(activeId, true);
  }, [activeId, loadMessages]);

  useEffect(() => {
    if (!profileReady) return;
    refreshChats();
    const db = getSupabase();
    const channel = db.channel('basic-chat-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'basic_messages' }, (event) => {
        if (event.eventType === 'INSERT' && event.new?.chat_id === activeRef.current &&
            document.visibilityState === 'visible' && noticeRealtimeMessage(incomingRef.current, event.new, user.id)) {
          playNotificationSound();
        }
        refreshChats();
        if (event.new?.chat_id === activeRef.current) loadMessages(activeRef.current);
      }).subscribe();
    const poll = setInterval(() => {
      refreshChats();
      if (activeRef.current) loadMessages(activeRef.current);
    }, 10000);
    const recentPoll = setInterval(checkRecentMessages, 3000);
    const focus = () => {
      refreshChats();
      if (activeRef.current) loadMessages(activeRef.current);
    };
    window.addEventListener('focus', focus);
    return () => {
      clearInterval(poll);
      clearInterval(recentPoll);
      window.removeEventListener('focus', focus);
      db.removeChannel(channel);
    };
  }, [profileReady, user?.id, refreshChats, loadMessages, checkRecentMessages]);

  const scrollToLatest = useCallback(() => {
    const list = messageListRef.current;
    if (list && followMessagesRef.current) list.scrollTop = list.scrollHeight;
  }, []);

  useEffect(() => { scrollToLatest(); }, [messages.length, activeId, scrollToLatest]);

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
      const privatePhone = normalizePhone(authForm.phone);
      if (!validDisplayName(authForm.name) || !validPrivatePhone(privatePhone) || /[a-z]/i.test(authForm.phone)) {
        setNotice('Enter a display name without contact details and a valid private phone number.');
        setAuthBusy(false);
        return;
      }
      result = await db.auth.signUp({
        email, password: authForm.password,
        options: {
          data: { display_name: authForm.name.trim(), private_phone: privatePhone },
          emailRedirectTo: window.location.origin + window.location.pathname,
        },
      });
    } else {
      result = await db.auth.signInWithPassword({ email, password: authForm.password });
    }
    if (result.error) {
      const rateLimited = /rate limit|too many|email.*exceeded/i.test(result.error.message);
      setNotice(rateLimited
        ? 'Too many attempts right now. Please wait a little and try again.'
        : result.error.message);
    } else if (authMode === 'signup' && !result.data.session) {
      setNotice('Check your email to confirm your account, then return here to sign in.');
    }
    setAuthBusy(false);
  }

  async function googleLogin() {
    setNotice('');
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) setNotice(error.message);
  }

  async function send(value) {
    const body = normalizeMessage(value);
    if (!activeId || !body || sending) return false;
    setSending(true);
    setNotice('');
    try {
      const { error } = await getSupabase().from('basic_messages').insert({
        chat_id: activeId, sender_id: user.id, body,
      });
      if (error) throw error;
      followMessagesRef.current = true;
      await loadMessages(activeId);
      refreshChats();
      return true;
    } catch (error) {
      setNotice('Message not sent: ' + error.message);
      return false;
    } finally {
      setSending(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (profileBusy) return;
    const value = normalizePhone(phone);
    if (!validDisplayName(profileName) || !validPrivatePhone(value) || /[a-z]/i.test(phone)) {
      setNotice('Enter a display name without contact details and a valid private phone number.');
      return;
    }
    setProfileBusy(true);
    try {
      const { data, error } = await getSupabase().rpc('save_basic_profile', { p_display_name: profileName.trim(), p_phone: value });
      if (error) throw error;
      setProfile(data); setProfileName(data.display_name); setPhone(data.phone);
      setSettingsOpen(false); setNotice('Profile saved. Your email and phone number remain private.');
    } catch (error) { setNotice(error.message); }
    finally { setProfileBusy(false); }
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
      <div className="auth-theme-header">
        <div className="brand"><span className="brand-mark">✦</span> Samlap</div>
        <ThemeToggle />
      </div>
      <h1>Good conversations, kept simple.</h1>
      <p>Connect with a profile link or QR code. Start chatting when your request is accepted.</p>
      <div className="auth-art"><span>Hey! 👋</span><span>Good to hear from you ☀️</span><span>See you soon!</span></div>
    </section>
    <section className="auth-card">
      <h2>{authMode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
      <p>{authMode === 'signup' ? 'Start a fresh chat in a minute.' : 'Sign in to continue your conversations.'}</p>
      {inviteToken && <p className="invite-auth-note">Sign in or create an account to view this profile and send a chat request.</p>}
      <form onSubmit={submitAuth}>
        {authMode === 'signup' && <label>Display name (public)<input required minLength={2} maxLength={60} autoComplete="nickname" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Alex" /></label>}
        <label>Email<input required type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" /></label>
        {authMode === 'signup' && <label>Phone number (private)<input required type="tel" autoComplete="tel" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} placeholder="Include country code" maxLength={32} /></label>}
        <label>Password<input required type="password" minLength={authMode === 'signup' ? 8 : 6} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder={authMode === 'signup' ? 'At least 8 characters' : 'Your password'} /></label>
        {authMode === 'signup' && <small className="auth-privacy-note">Only your display name is shared. Your email and phone number stay private.</small>}
        <button className="primary" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'}</button>
      </form>
      <div className="divider">or</div>
      {confirmationRequired && authMode === 'signup' && <p className="provider-note">We’ll send you an email to confirm your account.</p>}
      <button className="google" onClick={googleLogin} disabled={!googleReady}>Continue with Google</button>
      {!googleReady && <p className="provider-note">Google sign-in is unavailable right now. Use email and password to continue.</p>}
      <button className="switch" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setNotice(''); }}>
        {authMode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
      </button>
      {notice && <p className="notice" role="alert">{notice}</p>}
    </section>
  </main>;

  return <main className="app-shell">
    <aside className={'sidebar ' + (activeId || activeSpaceId ? 'mobile-hidden' : '')}>
      <header className="sidebar-header">
        <div className="brand"><span className="brand-mark">✦</span> Samlap</div>
        <div className="sidebar-actions">
          <ThemeToggle />
          <button className="icon-button" title={settingsOpen ? 'Close settings' : 'Settings'} aria-label={settingsOpen ? 'Close settings' : 'Settings'} aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>{settingsOpen ? '×' : '⚙'}</button>
        </div>
      </header>
      {settingsOpen && <form className="settings" onSubmit={saveProfile}>
        <strong>Your profile</strong>
        <label>Display name (public)<input required minLength={2} maxLength={60} value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Your display name" /></label>
        <label>Email (private)<input type="email" value={user.email || ''} readOnly /></label>
        <label>Phone number (private)<input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Include country code" maxLength={32} /></label>
        <small>Only you can see your email and phone. Your phone number is self-reported, not verified.</small>
        <button className="small-primary" disabled={profileBusy || !profileReady}>{profileBusy ? 'Saving…' : 'Save profile'}</button>
        <button type="button" className="small-primary" onClick={togglePush}
          disabled={pushBusy || !pushSupported() || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}>
          {pushBusy ? 'Please wait…' : pushEnabled ? 'Disable notifications' : 'Enable notifications'}
        </button>
        {!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && <small>Push setup is not complete yet.</small>}
        {!pushSupported() && <small>Push needs HTTPS and a supported browser. On iPhone, open Samlap in Safari, tap Share → Add to Home Screen, then launch the Home Screen app and enable notifications there.</small>}
        <button type="button" className="text-button" onClick={signOut}>Sign out</button>
      </form>}
      {profileReady && profile && <ProfileConnections key={user.id} profile={profile} userId={user.id}
        hidden={settingsOpen} inviteToken={inviteToken} onOpenChat={openConnectedChat} onRefreshChats={refreshChats}>
      <div className="section-title">Messages <span>{chats.length}</span></div>
      <div className="chat-list">
        {chats.map((chat) => <button key={chat.chat_id} className={'chat-item ' + (chat.chat_id === activeId ? 'selected' : '')} onClick={() => { setActiveSpaceId(null); setActiveId(chat.chat_id); }}>
          <span className="avatar">{initials(chat.peer_name)}</span>
          <span className="chat-item-main"><strong>{chat.peer_name}</strong><small>{messagePreview(chat.last_body) || 'Start your conversation'}</small></span>
          <span className="chat-meta"><time>{time(chat.last_at)}</time>{Number(chat.unread_count) > 0 && <b>{chat.unread_count}</b>}</span>
        </button>)}
        {profileReady && chats.length === 0 && <p className="empty-list">No chats yet. Open a profile link or scan a QR code, then send a chat request.</p>}
      </div>
      <SpaceList userId={user.id} contacts={chats} activeSpaceId={activeSpaceId} onOpenSpace={openSpace} refreshKey={spaceRevision} />
      </ProfileConnections>}
      {!profileReady && !settingsOpen && <p className="empty-list">Preparing your account…</p>}
      <footer className="sidebar-footer">{profile?.display_name || 'Your private account'}</footer>
    </aside>
    <section className={'conversation ' + (!activeId && !activeSpaceId ? 'mobile-hidden' : '')}>
      {activeSpaceId ? <SpaceConversation key={activeSpaceId + ':' + spaceEntry.key} spaceId={activeSpaceId} user={user} contacts={chats} initialView={spaceEntry.view} initialTaskId={spaceEntry.taskId} onBack={closeSpace} onUpdated={updateSpaces} /> : active ? <>
        <header className="conversation-header">
          <button className="back-button" onClick={() => setActiveId(null)} aria-label="Back to chats">←</button>
          <span className="avatar">{initials(active.peer_name)}</span>
          <div className="conversation-peer"><strong>{active.peer_name}</strong><small>Connected on Samlap</small></div>
          <ThemeToggle />
        </header>
        <div className="message-list" ref={messageListRef} onScroll={(event) => {
          const list = event.currentTarget;
          followMessagesRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        }}>
          {chatLoading && <p className="messages-note">Loading messages…</p>}
          {!chatLoading && messages.length === 0 && <p className="messages-note">Say hello to {active.peer_name} 👋</p>}
          {messages.map((message) => {
            const gif = parseGifMessage(message.body);
            const emojiOnly = !gif && isEmojiOnly(message.body);
            return <div key={message.id} className={'message-row ' + (message.sender_id === user.id ? 'mine' : '')}>
              {emojiOnly ? <span className="emoji-message" title={time(message.created_at)}>{message.body}</span> : <div className={'bubble' + (gif ? ' gif-bubble' : '')}>
                {gif ? <div className="gif-message"><a href={gif.url} target="_blank" rel="noreferrer"><img src={gif.url} alt={gif.title} onLoad={scrollToLatest} /></a>{gif.text && <span>{gif.text}</span>}</div> : <span>{message.body}</span>}
                <small>{time(message.created_at)} {message.sender_id === user.id ? (message.read_at ? '✓✓' : '✓') : ''}</small>
              </div>}
            </div>;
          })}
        </div>
        <TypingIndicator names={typingUserIds.includes(active.peer_id) ? [active.peer_name] : []} />
        <MessageComposer key={activeId} onSend={send} sending={sending} onTypingChange={onTypingChange} />
      </> : <div className="welcome"><div className="welcome-sun">✦</div><h2>Connect on your terms.</h2><p>Share your profile QR or link. Chat starts when a request is accepted.</p></div>}
    </section>
    {(notice || taskAlerts.notice) && session && <div className="toast" role="status"><span>{notice || taskAlerts.notice.text}</span>
      {!notice && taskAlerts.notice && <button className="toast-action" onClick={() => { openSpace(taskAlerts.notice.space_id, 'tasks', taskAlerts.notice.task_id); taskAlerts.dismiss(); }}>View tasks</button>}
      <button aria-label="Dismiss notification" onClick={() => { setNotice(''); taskAlerts.dismiss(); }}>×</button></div>}
  </main>;
}
