'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from './supabase';
import { createTypingSession } from './typing';

export function useConversationTyping({ conversationId, kind, userId, enabled = true }) {
  const sessionRef = useRef(null);
  const [snapshot, setSnapshot] = useState({ scope: '', people: [] });
  const scope = enabled && conversationId && userId ? `${kind}:${conversationId}:${userId}` : '';

  useEffect(() => {
    if (!scope) return;
    const db = getSupabase();
    const sessionId = crypto.randomUUID();
    let live = true, sequence = 0;
    const params = { p_conversation_id: conversationId, p_kind: kind };
    const session = createTypingSession({ publish: async (typing) => {
      const { error } = await db.rpc('set_conversation_typing', { ...params, p_session_id: sessionId, p_typing: typing });
      if (error) throw error;
    } });
    sessionRef.current = session;
    async function refresh() {
      if (!live || document.visibilityState !== 'visible') return;
      const request = ++sequence;
      // Count network time against TTL rather than extending stale activity.
      const started = Date.now();
      const { data, error } = await db.rpc('list_conversation_typing', params);
      if (!live || sequence !== request) return;
      setSnapshot({ scope, people: error ? [] : (data || []).map((person) => ({
        userId: person.user_id, until: started + Math.min(6000, Math.max(0, person.ttl_ms)),
      })).filter((person) => person.until > Date.now()) });
    }
    const refreshQuietly = () => { refresh().catch(() => {
      if (live) setSnapshot({ scope, people: [] });
    }); };
    const channel = db.channel('typing-' + scope + ':' + sessionId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_typing', filter: `${kind === 'space' ? 'space_id' : 'chat_id'}=eq.${conversationId}` }, refreshQuietly)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_typing', filter: `${kind === 'space' ? 'space_id' : 'chat_id'}=eq.${conversationId}` }, refreshQuietly)
      .subscribe((status) => { if (status === 'SUBSCRIBED') refreshQuietly(); });
    const hide = () => {
      session.stop();
      sequence++;
      if (live) setSnapshot({ scope, people: [] });
    };
    const visibility = () => { if (document.visibilityState !== 'visible') hide(); else refreshQuietly(); };
    const focus = () => refreshQuietly();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', hide);
    window.addEventListener('pagehide', hide);
    window.addEventListener('focus', focus);
    const interval = setInterval(refreshQuietly, 3000);
    refreshQuietly();
    return () => {
      live = false; sequence++; session.dispose();
      if (sessionRef.current === session) sessionRef.current = null;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', hide);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('focus', focus);
      db.removeChannel(channel);
    };
  }, [scope, conversationId, kind, userId]);

  useEffect(() => {
    if (!snapshot.people.length) return;
    const timer = setTimeout(() => setSnapshot((current) => ({ ...current,
      people: current.people.filter((person) => person.until > Date.now()),
    })), Math.max(0, Math.min(...snapshot.people.map((person) => person.until)) - Date.now()));
    return () => clearTimeout(timer);
  }, [snapshot]);

  const onTypingChange = useCallback((hasText) => {
    if (document.visibilityState === 'visible') sessionRef.current?.activity(Boolean(hasText));
  }, []);
  return { typingUserIds: snapshot.scope === scope ? snapshot.people.map((person) => person.userId) : [], onTypingChange };
}
