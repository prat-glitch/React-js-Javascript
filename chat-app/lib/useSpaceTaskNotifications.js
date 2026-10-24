'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getSupabase } from './supabase';
import { spaceRpc } from './space-client';
import { useTransientMessage } from './useTransientMessage';
import { playNotificationSound } from './notification-sound';

// Lives above chat navigation so assignments still arrive while viewing a QR,
// settings, another conversation, or another group's shared resources.
export function useSpaceTaskNotifications(userId, enabled) {
  const [notice, setNotice] = useTransientMessage('', 6000);
  const seenRef = useRef(new Set());
  const liveRef = useRef(false);
  const sequenceRef = useRef(0);
  const refresh = useCallback(async () => {
    if (!userId || !enabled) return;
    const sequence = ++sequenceRef.current;
    try {
      const notifications = await spaceRpc('list_my_space_task_notifications');
      if (!liveRef.current || sequence !== sequenceRef.current || document.visibilityState !== 'visible') return;
      const fresh = notifications.filter((item) => !seenRef.current.has(item.id));
      notifications.forEach((item) => seenRef.current.add(item.id));
      const fromOthers = fresh.filter((item) => item.actor_id !== userId);
      if (fromOthers.length && document.visibilityState === 'visible') {
        const first = fromOthers[0];
        setNotice({ ...first, text: fromOthers.length > 1 ? `${fromOthers.length} new tasks assigned to you.` : `${first.actor_name || 'A group admin'} assigned you a task in ${first.space_title}.` });
        playNotificationSound();
      }
    } catch { /* A failed refresh never replaces the user's current action notice. */ }
  }, [userId, enabled, setNotice]);

  useEffect(() => {
    liveRef.current = true;
    seenRef.current = new Set();
    setNotice('');
    const sequence = sequenceRef;
    if (!userId || !enabled) return () => { liveRef.current = false; sequence.current++; };
    refresh();
    const db = getSupabase();
    const channel = db.channel('my-task-assignments-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'space_task_notifications', filter: 'recipient_id=eq.' + userId }, refresh).subscribe();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 8000);
    const focus = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => { liveRef.current = false; sequence.current++; clearInterval(interval); db.removeChannel(channel); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [userId, enabled, refresh, setNotice]);
  return { notice, dismiss: () => setNotice('') };
}
