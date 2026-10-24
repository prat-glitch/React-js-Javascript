'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTransientMessage } from '../lib/useTransientMessage';
import { getSupabase } from '../lib/supabase';
import { spaceRpc } from '../lib/space-client';
import { messagePreview } from '../lib/message-content';
import { playNotificationSound } from '../lib/notification-sound';
import SpaceDialog from './SpaceDialog';

export function SpacePeoplePicker({ contacts, selected, onChange, disabled = false }) {
  return <div className="space-people-picker">
    {!contacts.length && <p className="space-muted">Connect with someone first to invite them. You can also start a space on your own.</p>}
    {contacts.map((contact) => <label key={contact.peer_id} className="space-person-option">
      <span className="avatar">{contact.peer_name.slice(0, 1).toUpperCase()}</span><span>{contact.peer_name}</span>
      <input type="checkbox" checked={selected.includes(contact.peer_id)} disabled={disabled || (!selected.includes(contact.peer_id) && selected.length >= 19)}
        onChange={(event) => onChange(event.target.checked ? [...selected, contact.peer_id] : selected.filter((id) => id !== contact.peer_id))} />
    </label>)}
  </div>;
}

function CreateSpace({ contacts, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useTransientMessage('', 8000);
  async function submit(event) {
    event.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true); setError('');
    try {
      const id = await spaceRpc('create_space', { p_title: title.trim(), p_purpose: purpose.trim(), p_member_ids: members });
      onCreated(id);
    } catch (err) { setError(err.message); setBusy(false); }
  }
  return <SpaceDialog title="Create a space" onClose={onClose} busy={busy}>
    <p className="space-dialog-intro">A place for a trip, a project, or a plan. Keep the conversation and the next steps together.</p>
    <form className="space-form" onSubmit={submit}>
      <label>Space name<input autoFocus required maxLength={80} placeholder="e.g. Darjeeling trip" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>What’s the plan? <span className="space-optional">Optional</span><textarea maxLength={500} rows={2} placeholder="A little context for everyone" value={purpose} onChange={(event) => setPurpose(event.target.value)} /></label>
      <fieldset disabled={busy}><legend>Invite your connections <span className="space-optional">Optional</span></legend>
        <SpacePeoplePicker contacts={contacts} selected={members} onChange={setMembers} disabled={busy} /></fieldset>
      <p className="space-muted">People choose whether to join. Only members who join can see messages and shared items.</p>
      {error && <p className="space-error" role="alert">{error}</p>}
      <button className="small-primary" disabled={busy || !title.trim()}>{busy ? 'Creating…' : members.length ? `Create & invite ${members.length}` : 'Create space'}</button>
    </form>
  </SpaceDialog>;
}

export default function SpaceList({ userId, contacts, activeSpaceId, onOpenSpace, refreshKey = 0 }) {
  const [data, setData] = useState({ spaces: [], invitations: [] });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useTransientMessage('', 8000);
  const [busy, setBusy] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const previousRef = useRef(null);
  const mountedRef = useRef(false);
  const activeRef = useRef(activeSpaceId);
  useEffect(() => { activeRef.current = activeSpaceId; }, [activeSpaceId]);
  const refresh = useCallback(async () => {
    try {
      const result = await spaceRpc('list_spaces');
      if (!mountedRef.current) return;
      if (previousRef.current && document.visibilityState === 'visible' && result.spaces.some((space) =>
        space.id !== activeRef.current && space.last_kind !== 'system' && Number(space.unread_count) > (previousRef.current.get(space.id) || 0))) playNotificationSound();
      previousRef.current = new Map(result.spaces.map((space) => [space.id, Number(space.unread_count)]));
      setData(result); setError(''); setLoaded(true);
    } catch (err) { if (mountedRef.current) { setError(err.message); setLoaded(true); } }
  }, []);
  useEffect(() => { if (refreshKey) refresh(); }, [refreshKey, refresh]);
  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const db = getSupabase();
    const channel = db.channel('space-list-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'space_members', filter: 'user_id=eq.' + userId }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'space_messages' }, refresh).subscribe();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 10000);
    window.addEventListener('focus', refresh);
    return () => { mountedRef.current = false; clearInterval(interval); window.removeEventListener('focus', refresh); db.removeChannel(channel); };
  }, [userId, refresh]);

  async function respond(spaceId, accept) {
    if (busy) return;
    setBusy(spaceId); setActionError('');
    try {
      await spaceRpc('respond_space_invite', { p_space_id: spaceId, p_accept: accept });
      await refresh();
      if (accept) onOpenSpace(spaceId);
    } catch (err) { setActionError(err.message); }
    finally { setBusy(null); }
  }
  return <section className="space-list-section" aria-label="Your conversation spaces">
    <div className="space-list-heading"><span>Spaces</span><button type="button" className="text-button" aria-label="Create a space" onClick={() => setCreating(true)}>＋ New</button></div>
    {data.invitations.map((invitation) => <article className="space-invitation" key={invitation.space_id}>
      <small>{invitation.inviter_name} invited you</small><strong>{invitation.title}</strong>
      {invitation.purpose && <p>{invitation.purpose}</p>}
      <div className="connection-actions"><button className="small-primary" disabled={Boolean(busy)} onClick={() => respond(invitation.space_id, true)}>{busy === invitation.space_id ? 'Please wait…' : 'Join space'}</button>
        <button className="text-button" disabled={Boolean(busy)} onClick={() => respond(invitation.space_id, false)}>Decline</button></div>
    </article>)}
    {data.spaces.map((space) => <button key={space.id} className={'chat-item space-list-item' + (activeSpaceId === space.id ? ' selected' : '')} onClick={() => onOpenSpace(space.id)}>
      <span className="avatar space-avatar" aria-hidden="true">{space.title.slice(0, 1).toUpperCase()}</span>
      <span className="chat-item-main"><strong>{space.title}</strong><small>{messagePreview(space.last_body) || space.purpose || 'Your space is ready'}</small></span>
      <span className="chat-meta"><span>{space.member_count} {Number(space.member_count) === 1 ? 'member' : 'members'}</span><span className="space-list-badges">{Number(space.task_notification_count) > 0 && <span className="space-task-assignment-badge" aria-label={space.task_notification_count + ' new task assignments for you'}>✓ {space.task_notification_count}</span>}{Number(space.unread_count) > 0 && <b>{space.unread_count}</b>}</span></span>
    </button>)}
    {loaded && !data.spaces.length && !error && <div className="space-list-empty"><p>Make room for a shared plan.</p><span>Trips, projects, study sessions — each gets its own space.</span></div>}
    {!loaded && <p className="space-list-empty">Loading spaces…</p>}
    {error && <div className="space-list-error" role="status"><p>{error}</p><button className="text-button" onClick={refresh}>Try again</button></div>}
    {actionError && <p className="space-error" role="alert">{actionError}</p>}
    {creating && <CreateSpace contacts={contacts} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); refresh(); onOpenSpace(id); }} />}
  </section>;
}
