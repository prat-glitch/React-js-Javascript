'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { spaceRpc } from '../lib/space-client';
import { safeSpaceUrl } from '../lib/spaces';
import { parseGifMessage } from '../lib/message-content';
import SpaceDialog from './SpaceDialog';
import { SpacePeoplePicker } from './SpaceList';
import { SpaceAttachment } from './SpaceMessage';
import { useTransientMessage } from '../lib/useTransientMessage';

function InviteMembers({ spaceId, contacts, members, onClose, onUpdated }) {
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useTransientMessage('', 8000);
  const eligible = contacts.filter((contact) => !members.some((member) => member.user_id === contact.peer_id));
  async function invite(event) {
    event.preventDefault(); if (busy || !selected.length) return;
    setBusy(true); setError('');
    try { await spaceRpc('invite_space_members', { p_space_id: spaceId, p_member_ids: selected }); await onUpdated(); onClose(); }
    catch (err) { setError(err.message); setBusy(false); }
  }
  return <SpaceDialog title="Invite people" onClose={onClose} busy={busy}><form className="space-form" onSubmit={invite}>
    <p className="space-dialog-intro">Choose from your connections. They’ll receive an invitation and can decide whether to join.</p>
    <SpacePeoplePicker contacts={eligible} selected={selected} onChange={setSelected} disabled={busy} />
    {!eligible.length && <p className="space-muted">There are no more connections to invite.</p>}
    <p className="space-muted">A space can have up to 20 people, including pending invitations.</p>
    {error && <p className="space-error" role="alert">{error}</p>}<button className="small-primary" disabled={busy || !selected.length}>{busy ? 'Inviting…' : 'Send invitations'}</button>
  </form></SpaceDialog>;
}

function SpaceLibrary({ spaceId, links, onSource, onAddLink, onBack }) {
  const [kind, setKind] = useState('media');
  const [resources, setResources] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const requestRef = useRef(0);
  const load = useCallback(async (cursor = null, append = false) => {
    if (kind === 'links') return;
    const sequence = ++requestRef.current;
    setBusy(true); setError('');
    try {
      const items = await spaceRpc('list_space_resources', { p_space_id: spaceId, p_kind: kind, p_before: cursor?.created_at || null, p_before_id: cursor?.id || null, p_limit: 50 });
      if (requestRef.current !== sequence) return;
      setResources((current) => append ? [...current, ...items.filter((item) => !current.some((existing) => existing.id === item.id))] : items);
      setMore(items.length === 50);
    } catch (err) { if (requestRef.current === sequence) setError(err.message); }
    finally { if (requestRef.current === sequence) setBusy(false); }
  }, [spaceId, kind]);
  useEffect(() => { const sequence = requestRef; setResources([]); setMore(false); load(); return () => { sequence.current++; }; }, [load]);
  return <>
    <header className="space-details-header"><button className="icon-button" aria-label="Back to space info" onClick={onBack}>←</button><h2>Media, files and links</h2></header>
    <div className="space-library-tabs" role="tablist" aria-label="Shared resources">{[['media', 'Media'], ['files', 'Files'], ['links', 'Links']].map(([id, label]) =>
      <button key={id} role="tab" aria-selected={kind === id} id={'space-library-' + id} aria-controls="space-library-panel" onClick={() => setKind(id)}>{label}</button>)}</div>
    <section className="space-library-content" id="space-library-panel" role="tabpanel" aria-labelledby={'space-library-' + kind}>
      <div className="space-library-toolbar"><span>{kind === 'links' ? 'Links shared in this space' : kind === 'files' ? 'Documents shared in chat' : 'Photos, videos, audio & GIFs'}</span>
        {kind === 'links' ? <button className="text-button" onClick={onAddLink}>＋ Add link</button> : <button className="text-button" disabled={busy} onClick={() => load()}>Refresh</button>}</div>
      {kind === 'links' ? <div className="space-link-list">{links.map((link) => {
        const url = safeSpaceUrl(link.url);
        if (!url) return null;
        return <article className="space-link-item" key={link.id}><a href={url} target="_blank" rel="noreferrer"><span className="space-link-icon" aria-hidden="true">↗</span><span><strong>{link.title || new URL(url).hostname}</strong><small>{url}</small></span></a>
          {link.source_message_id && <button className="space-source-link" onClick={() => onSource(link.source_message_id)}>View message ↗</button>}</article>;
      })}{!links.length && <div className="space-library-empty"><h3>No links yet.</h3><p>Links shared in chat are collected here automatically. You can also add one yourself.</p></div>}</div> : <>
        <div className={kind === 'media' ? 'space-media-grid' : 'space-file-list'}>{resources.map((message) => {
          const gif = parseGifMessage(message.body);
          return <article key={message.id} className="space-library-resource">
            {message.attachment ? <SpaceAttachment attachment={message.attachment} thumbnail={kind === 'media'} /> : gif && <img className="space-library-gif" src={gif.url} alt={gif.title} loading="lazy" />}
            <div className="space-resource-meta"><span>{new Date(message.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span><button className="space-source-link" onClick={() => onSource(message.id)}>In chat ↗</button></div>
          </article>;
        })}</div>
        {!resources.length && !busy && !error && <div className="space-library-empty"><h3>{kind === 'media' ? 'Your memories will live here.' : 'No files yet.'}</h3><p>{kind === 'media' ? 'Share a photo, video, audio clip, or GIF in chat to see it here.' : 'Send a document using the ＋ button in chat. It will be easy to find here later.'}</p></div>}
        {busy && <p className="space-muted" role="status">Loading…</p>}
        {error && <div role="alert" className="space-error">{error}<button className="text-button" onClick={() => load()}>Try again</button></div>}
        {more && <button className="connection-secondary space-load-more" disabled={busy} onClick={() => load(resources[resources.length - 1], true)}>Load more</button>}
      </>}
    </section>
  </>;
}

export default function SpaceDetails({ space, members, links, userId, contacts, onClose, onSource, onAddLink, onUpdated, onLeft, onStatus }) {
  const [library, setLibrary] = useState(false);
  const [invite, setInvite] = useState(false);
  const [leave, setLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useTransientMessage('', 8000);
  const [manageId, setManageId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const joined = members.filter((member) => member.status === 'joined');
  const invited = members.filter((member) => member.status === 'invited');
  const owner = space.owner_id === userId;
  const isAdmin = members.some((member) => member.user_id === userId && member.status === 'joined' && ['owner', 'admin'].includes(member.role));
  const managed = members.find((member) => member.user_id === manageId && member.status === 'joined');
  async function changeMember(remove = false) {
    if (!managed || busy) return;
    setBusy(true); setError('');
    try {
      await spaceRpc(remove ? 'remove_space_member' : 'set_space_member_admin', { p_space_id: space.id, p_user_id: managed.user_id, ...(remove ? {} : { p_admin: managed.role !== 'admin' }) });
      const text = remove ? managed.display_name + ' was removed from the group.' : managed.display_name + (managed.role === 'admin' ? ' is no longer a group admin.' : ' is now a group admin.');
      setManageId(null); setConfirmRemove(false); await onUpdated(); onStatus?.(text);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function leaveSpace() {
    if (busy) return; setBusy(true); setError('');
    try { await spaceRpc('leave_space', { p_space_id: space.id }); onLeft(); }
    catch (err) { setError(err.message); setBusy(false); }
  }
  return <aside className="space-details" aria-label="Space info">
    {library ? <SpaceLibrary spaceId={space.id} links={links} onBack={() => setLibrary(false)} onSource={onSource} onAddLink={onAddLink} /> : <>
      <header className="space-details-header"><button type="button" className="icon-button" aria-label="Close space info" onClick={onClose}>←</button><h2>Space info</h2></header>
      <div className="space-details-scroll">
        <div className="space-profile"><span className="avatar space-avatar">{space.title.slice(0, 1).toUpperCase()}</span><h2>{space.title}</h2><span>{joined.length} {joined.length === 1 ? 'member' : 'members'} · Private space</span>{space.purpose && <p>{space.purpose}</p>}</div>
        <button className="space-resources-entry" onClick={() => setLibrary(true)}><span><strong>Media, files and links</strong><small>Everything shared, easy to find</small></span><span aria-hidden="true">›</span></button>
        <section className="space-member-section"><header><h3>Members <span>{joined.length}</span></h3>{isAdmin && <button className="text-button" onClick={() => setInvite(true)}>＋ Invite</button>}</header>
          {joined.map((member) => <div className="space-member" key={member.user_id}><span className="avatar">{member.display_name.slice(0, 1).toUpperCase()}</span><span><strong>{member.display_name}{member.user_id === userId ? ' (you)' : ''}</strong><small>{member.role === 'owner' ? 'Group owner · Admin' : member.role === 'admin' ? 'Group admin' : 'Member'}</small></span>
            {isAdmin && member.user_id !== userId && member.role !== 'owner' && <button className="space-member-menu" aria-label={'Manage ' + member.display_name} aria-haspopup="dialog" onClick={() => { setManageId(member.user_id); setConfirmRemove(false); setError(''); }}>···</button>}
          </div>)}
          {invited.length > 0 && <div className="space-pending-members"><h4>Invited · {invited.length}</h4>{invited.map((member) => <div className="space-member" key={member.user_id}><span className="avatar">{member.display_name.slice(0, 1).toUpperCase()}</span><span><strong>{member.display_name}</strong><small>Waiting to join</small></span></div>)}</div>}
        </section>
        <p className="space-footnote">Only members can read the conversation and shared items. Email addresses and phone numbers stay private.</p>
        {!owner && <button className="space-leave-button" onClick={() => setLeave(true)}>Leave space</button>}
      </div>
    </>}
    {invite && <InviteMembers spaceId={space.id} contacts={contacts} members={members} onClose={() => setInvite(false)} onUpdated={onUpdated} />}
    {managed && <SpaceDialog title={confirmRemove ? 'Remove ' + managed.display_name + '?' : managed.display_name} onClose={() => { setManageId(null); setConfirmRemove(false); setError(''); }} busy={busy}>
      {confirmRemove ? <><p className="space-dialog-intro">They will lose access to this space. Their messages will stay, and their open tasks will return to the shared checklist.</p><div className="space-confirm-actions"><button className="space-danger" disabled={busy} onClick={() => changeMember(true)}>{busy ? 'Removing…' : 'Remove from group'}</button><button className="connection-secondary" disabled={busy} onClick={() => setConfirmRemove(false)}>Keep member</button></div></> : <div className="space-action-list"><button disabled={busy} onClick={() => changeMember()}><strong>{managed.role === 'admin' ? 'Dismiss as admin' : 'Make group admin'}</strong><span>{managed.role === 'admin' ? 'They will remain a member of the group.' : 'Allow them to manage members and assign tasks.'}</span></button><button disabled={busy} onClick={() => setConfirmRemove(true)}><strong>Remove from group</strong><span>End their access to the conversation and shared items.</span></button></div>}
      {error && <p className="space-error" role="alert">{error}</p>}
    </SpaceDialog>}
    {leave && <SpaceDialog title="Leave this space?" onClose={() => setLeave(false)} busy={busy}><p className="space-dialog-intro">You’ll lose access to the chat, files, decisions, and tasks in {space.title}. Your messages will stay for the other members.</p>{error && <p className="space-error" role="alert">{error}</p>}<div className="space-confirm-actions"><button className="space-danger" onClick={leaveSpace} disabled={busy}>{busy ? 'Leaving…' : 'Leave space'}</button><button className="connection-secondary" disabled={busy} onClick={() => setLeave(false)}>Stay</button></div></SpaceDialog>}
  </aside>;
}
