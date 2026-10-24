'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { sendSpaceMessage, spaceRpc } from '../lib/space-client';
import { localDateKey, mergeSpaceMessages } from '../lib/spaces';
import { playNotificationSound } from '../lib/notification-sound';
import { ThemeToggle } from './ThemeProvider';
import MessageComposer from './MessageComposer';
import TypingIndicator from './TypingIndicator';
import { useConversationTyping } from '../lib/useConversationTyping';
import SpaceMessage from './SpaceMessage';
import SpaceDetails from './SpaceDetails';
import { SpaceDecisionForm, SpaceDecisions, SpaceLinkForm, SpaceMessageActions, SpaceOriginalMessage, SpaceTaskForm, SpaceTasks } from './SpaceTools';
import { useTransientMessage } from '../lib/useTransientMessage';
import SpacePolls, { SpacePollSource } from './SpacePolls';

function dayLabel(value) {
  const date = new Date(value);
  if (localDateKey(date) === localDateKey()) return 'Today';
  return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SpaceConversation({ spaceId, user, contacts, onBack, onUpdated, initialView = 'chat', initialTaskId = null }) {
  const [data, setData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [tab, setTab] = useState(initialView === 'tasks' ? 'tasks' : 'chat');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useTransientMessage();
  const [dialog, setDialog] = useState(null);
  const [decisionView, setDecisionView] = useState('decisions');
  const listRef = useRef(null);
  const stackRef = useRef(null);
  const followRef = useRef(true);
  const priorHeightRef = useRef(null);
  const knownRef = useRef(null);
  const liveRef = useRef(false);
  const sequenceRef = useRef(0);
  const readRef = useRef('');
  const chatVisibleRef = useRef(true);
  const tasksVisibleRef = useRef(initialView === 'tasks');
  const taskReadsRef = useRef(new Set());
  const ready = Boolean(data);
  const { typingUserIds, onTypingChange } = useConversationTyping({
    conversationId: spaceId, kind: 'space', userId: user.id,
    enabled: ready && tab === 'chat' && !detailsOpen,
  });

  useEffect(() => { chatVisibleRef.current = tab === 'chat' && !detailsOpen; tasksVisibleRef.current = tab === 'tasks' && !detailsOpen; }, [tab, detailsOpen]);
  useEffect(() => { setTab(initialView === 'tasks' ? 'tasks' : 'chat'); }, [initialView, initialTaskId]);
  const refresh = useCallback(async () => {
    const sequence = ++sequenceRef.current;
    try {
      const [snapshot, latest] = await Promise.all([
        spaceRpc('get_space', { p_space_id: spaceId }),
        spaceRpc('list_space_messages', { p_space_id: spaceId, p_before: null, p_before_id: null, p_limit: 50 }),
      ]);
      if (!liveRef.current || sequence !== sequenceRef.current) return;
      const historyGap = knownRef.current && latest.length === 50 && latest.every((item) => !knownRef.current.has(item.id));
      if (knownRef.current && document.visibilityState === 'visible' && latest.some((item) => item.kind !== 'system' && !knownRef.current.has(item.id) && item.sender_id !== user.id)) playNotificationSound();
      if (!knownRef.current) { knownRef.current = new Set(); setHasOlder(latest.length === 50); }
      latest.forEach((item) => knownRef.current.add(item.id));
      // After a long suspension, reset to a continuous page rather than merge
      // disconnected ends of the history. Earlier messages stays reachable.
      if (historyGap) { setHasOlder(true); followRef.current = true; }
      setData(snapshot); setMessages((current) => mergeSpaceMessages(historyGap ? [] : current, latest));
      setLoadError(''); setLoading(false);
      const newest = latest[0]?.id || 'empty';
      if (latest.length && chatVisibleRef.current && document.visibilityState === 'visible' && readRef.current !== newest) {
        await spaceRpc('mark_space_read', { p_space_id: spaceId, p_message_id: newest });
        if (liveRef.current) { readRef.current = newest; onUpdated(); }
      }
      if (tasksVisibleRef.current && document.visibilityState === 'visible') {
        const ids = (snapshot.task_notifications || []).map((item) => item.id).filter((id) => !taskReadsRef.current.has(id));
        for (let offset = 0; offset < ids.length; offset += 100) {
          await spaceRpc('mark_space_task_notifications_read', { p_space_id: spaceId, p_notification_ids: ids.slice(offset, offset + 100) });
        }
        if (ids.length && liveRef.current) {
          ids.forEach((id) => taskReadsRef.current.add(id));
          setData((current) => current ? { ...current, task_notifications: (current.task_notifications || []).filter((item) => !taskReadsRef.current.has(item.id)) } : current);
          onUpdated();
        }
      }
    } catch (err) {
      if (!liveRef.current || sequence !== sequenceRef.current) return;
      setLoadError(err.message); setLoading(false);
      if (/not a member|not available|access denied|permission denied|joined (?:space )?member/i.test(err.message)) { setData(null); setMessages([]); }
    }
  }, [spaceId, user.id, onUpdated]);

  useEffect(() => {
    const sequence = sequenceRef;
    liveRef.current = true;
    refresh();
    const db = getSupabase();
    let channel = db.channel('space-conversation-' + spaceId);
    for (const table of ['spaces', 'space_members', 'space_messages', 'space_tasks', 'space_decisions', 'space_links', 'space_task_notifications']) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: (table === 'spaces' ? 'id' : 'space_id') + '=eq.' + spaceId }, refresh);
    }
    channel.subscribe();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 8000);
    const focus = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => { liveRef.current = false; sequence.current++; clearInterval(interval); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); db.removeChannel(channel); };
  }, [spaceId, refresh]);

  useEffect(() => {
    if ((tab === 'chat' || tab === 'tasks') && !detailsOpen && ready) {
      refresh();
    }
  }, [tab, detailsOpen, ready, refresh]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (priorHeightRef.current !== null) { list.scrollTop += list.scrollHeight - priorHeightRef.current; priorHeightRef.current = null; }
    else if (followRef.current) list.scrollTop = list.scrollHeight;
  }, [messages.length, tab]);
  useEffect(() => {
    if (tab !== 'chat' || !stackRef.current) return;
    const observer = new ResizeObserver(() => { if (followRef.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; });
    observer.observe(stackRef.current);
    return () => observer.disconnect();
  }, [tab, loading]);

  async function older() {
    if (olderBusy || !messages.length) return;
    setOlderBusy(true);
    try {
      const cursor = messages[0];
      const items = await spaceRpc('list_space_messages', { p_space_id: spaceId, p_before: cursor.created_at, p_before_id: cursor.id, p_limit: 50 });
      if (!liveRef.current) return;
      priorHeightRef.current = listRef.current?.scrollHeight ?? null;
      followRef.current = false;
      items.forEach((item) => knownRef.current.add(item.id));
      setMessages((current) => mergeSpaceMessages(current, items)); setHasOlder(items.length === 50);
    } catch (err) { setNotice(err.message); }
    finally { if (liveRef.current) setOlderBusy(false); }
  }
  async function send(body, file) {
    if (sending) return false;
    setSending(true); setNotice('');
    try {
      await sendSpaceMessage(spaceId, user.id, body, file);
      followRef.current = true;
      await refresh(); onUpdated();
      return true;
    } catch (err) { setNotice('Message not sent. ' + err.message); return false; }
    finally { if (liveRef.current) setSending(false); }
  }
  function action(message, type) {
    if (type === 'task-list') { setTab('tasks'); setDialog(null); }
    else if (type === 'decision-list') { setTab('decisions'); setDialog(null); }
    else setDialog({ type: 'actions', source: message });
  }
  function choose(type) {
    if (type === 'task-list' || type === 'decision-list') action(dialog.source, type);
    else setDialog({ type, source: dialog.source });
  }
  function saved(text) { setDialog(null); setNotice(text); refresh(); onUpdated(); }
  function source(id) { setDialog({ type: 'source', id }); }
  const tasks = data?.tasks || [];
  const decisions = data?.decisions || [];
  const members = data?.members || [];
  const assignmentCount = (data?.task_notifications || []).filter((item) => !taskReadsRef.current.has(item.id)).length;
  const space = data?.space;
  const isAdmin = members.some((member) => member.user_id === user.id && member.status === 'joined' && ['owner', 'admin'].includes(member.role));
  let previousDay = null;

  if (!space) return <div className="space-loading-page"><button className="text-button" onClick={onBack}>← Back to chats</button><p role={loadError ? 'alert' : 'status'}>{loadError || (loading ? 'Opening your space…' : 'This space is unavailable.')}</p>{loadError && <button className="connection-secondary" onClick={refresh}>Try again</button>}</div>;

  return <div className={'space-workspace' + (detailsOpen ? ' space-info-open' : '')}>
    <div className="space-main">
      <header className="conversation-header space-chat-header">
        <button className="back-button" aria-label="Back to chats" onClick={onBack}>←</button>
        <button className="space-title-button" aria-label={'Open space info for ' + space.title} aria-expanded={detailsOpen} onClick={() => setDetailsOpen(!detailsOpen)}>
          <span className="avatar space-avatar">{space.title.slice(0, 1).toUpperCase()}</span><span><strong>{space.title}</strong><small>{members.filter((member) => member.status === 'joined').length} members · Tap for info</small></span><span className="space-title-chevron" aria-hidden="true">⌄</span>
        </button><ThemeToggle />
      </header>
      <nav className="space-tabs" aria-label="Space views" role="tablist">{[['chat', 'Chat', null], ['decisions', 'Decisions', decisions.length], ['tasks', 'Tasks', assignmentCount]].map(([key, label, count]) =>
        <button type="button" role="tab" key={key} id={'space-tab-' + key} aria-selected={tab === key} aria-controls="space-view" onClick={() => setTab(key)}>{label}{Boolean(count) && <span className={key === 'tasks' ? 'space-task-assignment-badge' : undefined} aria-label={key === 'tasks' ? count + ' new assignments for you' : undefined}>{count}</span>}</button>)}</nav>
      {loadError && <div className="space-inline-notice space-error" role="alert">{loadError}<button className="text-button" onClick={refresh}>Retry</button></div>}
      {notice && <div className="space-inline-notice" role="status"><span>{notice}</span><button aria-label="Dismiss space notice" onClick={() => setNotice('')}>×</button></div>}
      <div className={'space-view space-view-' + tab} id="space-view" role="tabpanel" aria-labelledby={'space-tab-' + tab}>
        {tab === 'chat' && <>
          <div className="space-message-list" ref={listRef} onScroll={(event) => { const el = event.currentTarget; followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
            {hasOlder && <button className="space-history-button" disabled={olderBusy} onClick={older}>{olderBusy ? 'Loading…' : 'Earlier messages'}</button>}
            <div className="space-message-stack" ref={stackRef}>
              {!messages.length && <div className="space-chat-empty"><span className="space-empty-mark" aria-hidden="true">✦</span><h2>Every plan starts with a hello.</h2><p>Share an idea, a file, or a link. Turn the important bits into tasks and decisions as you go.</p></div>}
              {messages.map((message) => {
                const day = dayLabel(message.created_at);
                const changed = day !== previousDay; previousDay = day;
                return <div key={message.id} className="space-message-group">{changed && <div className="space-day-divider"><span>{day}</span></div>}
                  <SpaceMessage message={message} mine={message.sender_id === user.id} onAction={action} task={tasks.find((task) => task.source_message_id === message.id)} decision={decisions.find((decision) => decision.source_message_id === message.id)} />
                </div>;
              })}
            </div>
          </div>
          <TypingIndicator names={members.filter((member) => member.status === 'joined' && typingUserIds.includes(member.user_id)).map((member) => member.display_name)} />
          <MessageComposer onSend={send} sending={sending} allowAttachments onTypingChange={onTypingChange} />
        </>}
        {tab === 'tasks' && <SpaceTasks tasks={tasks} members={members} userId={user.id} isAdmin={isAdmin} initialMine={assignmentCount > 0 || Boolean(initialTaskId)} focusTaskId={initialTaskId} onCreate={() => setDialog({ type: 'task' })} onEdit={(task) => setDialog({ type: 'task', task })} onSource={source} onUpdated={refresh} onError={setNotice} />}
        {tab === 'decisions' && <div className="space-decision-hub">
          <div className="space-decision-switch" role="group" aria-label="Decisions and polls">
            <button type="button" aria-pressed={decisionView === 'decisions'} onClick={() => setDecisionView('decisions')}>Pinned decisions{decisions.length > 0 && <span>{decisions.length}</span>}</button>
            <button type="button" aria-pressed={decisionView === 'polls'} onClick={() => setDecisionView('polls')}>Polls</button>
          </div>
          {decisionView === 'polls' ? <SpacePolls spaceId={spaceId} members={members} userId={user.id} isAdmin={isAdmin} onDecision={() => { setDecisionView('decisions'); refresh(); }} onUpdated={refresh} onNotice={setNotice} /> : <SpaceDecisions decisions={decisions} members={members} userId={user.id} ownerId={space.owner_id} onCreate={() => setDialog({ type: 'decision' })} onSource={source} onPoll={(id) => setDialog({ type: 'poll-source', id })} onPolls={() => setDecisionView('polls')} onUpdated={refresh} onError={setNotice} />}
        </div>}
      </div>
    </div>
    {detailsOpen && <SpaceDetails space={space} members={members} links={data.links || []} userId={user.id} contacts={contacts} onClose={() => setDetailsOpen(false)} onSource={source} onAddLink={() => setDialog({ type: 'link' })} onUpdated={refresh} onStatus={setNotice} onLeft={() => { onUpdated(); onBack(); }} />}
    {dialog?.type === 'actions' && <SpaceMessageActions message={dialog.source} canAssign={isAdmin} task={tasks.find((task) => task.source_message_id === dialog.source.id)} decision={decisions.find((decision) => decision.source_message_id === dialog.source.id)} onClose={() => setDialog(null)} onChoose={choose} />}
    {dialog?.type === 'task' && <SpaceTaskForm spaceId={spaceId} members={members} source={dialog.source} task={dialog.task} canAssign={isAdmin} onClose={() => setDialog(null)} onSaved={saved} onExisting={() => { setDialog(null); setTab('tasks'); refresh(); }} />}
    {dialog?.type === 'decision' && <SpaceDecisionForm spaceId={spaceId} source={dialog.source} onClose={() => setDialog(null)} onSaved={saved} onExisting={() => { setDialog(null); setTab('decisions'); refresh(); }} />}
    {dialog?.type === 'link' && <SpaceLinkForm spaceId={spaceId} existingLinks={data.links || []} source={dialog.source} onClose={() => setDialog(null)} onSaved={saved} />}
    {dialog?.type === 'source' && <SpaceOriginalMessage key={dialog.id} messageId={dialog.id} members={members} onClose={() => setDialog(null)} />}
    {dialog?.type === 'poll-source' && <SpacePollSource key={dialog.id} pollId={dialog.id} members={members} userId={user.id} isAdmin={isAdmin} onClose={() => setDialog(null)} onUpdated={refresh} onDecision={() => { setDialog(null); setDecisionView('decisions'); refresh(); }} />}
  </div>;
}
