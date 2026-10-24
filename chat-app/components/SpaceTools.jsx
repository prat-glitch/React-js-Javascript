'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { spaceRpc } from '../lib/space-client';
import { messagePreview } from '../lib/message-content';
import { safeSpaceUrl, spaceMessageLinks, taskDueLabel } from '../lib/spaces';
import SpaceDialog from './SpaceDialog';
import { SpaceMessageBody } from './SpaceMessage';
import { useTransientMessage } from '../lib/useTransientMessage';

const dateLabel = (value) => new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short' });
const nameOf = (members, id) => members.find((member) => member.user_id === id)?.display_name || 'A member';

export function SpaceSourceSnippet({ message }) {
  return <blockquote className="space-source-snippet"><strong>From {message.sender_name || 'your conversation'}</strong>
    <span>{message.attachment?.name || messagePreview(message.body)}</span></blockquote>;
}

export function SpaceTaskForm({ spaceId, members, source, task, canAssign = false, onClose, onSaved, onExisting }) {
  const [title, setTitle] = useState(task?.title || (source ? messagePreview(source.body)?.slice(0, 240) || source.attachment?.name : '') || '');
  const [assignee, setAssignee] = useState(task?.assignee_id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useTransientMessage('', 8000);
  const [deleting, setDeleting] = useState(false);
  const [conflict, setConflict] = useState(false);
  async function save(event) {
    event.preventDefault(); if (busy || !title.trim()) return;
    const due = new FormData(event.currentTarget).get('due_date');
    const selectedAssignee = canAssign ? assignee || null : task?.assignee_id || null;
    setBusy(true); setError('');
    try {
      const id = await spaceRpc(task ? 'update_space_task' : 'save_space_task', {
        ...(task ? { p_task_id: task.id } : { p_space_id: spaceId, p_source_message_id: source?.id || null }),
        p_title: title.trim(), p_assignee_id: selectedAssignee, p_due_date: due || null,
      });
      if (source && !task) {
        const snapshot = await spaceRpc('get_space', { p_space_id: spaceId });
        const actual = snapshot.tasks.find((item) => item.id === id);
        if (!actual || actual.title !== title.trim() || actual.assignee_id !== selectedAssignee || actual.due_date !== (due || null)) {
          setConflict(true); setBusy(false); setError('A task already exists for this message. Your draft is still here; review the existing task before making changes.'); return;
        }
      }
      onSaved(task ? 'Task updated.' : 'Task added.');
    } catch (err) { setError(err.message); setBusy(false); }
  }
  async function remove() {
    if (busy) return;
    setBusy(true); setError('');
    try { await spaceRpc('remove_space_task', { p_task_id: task.id }); onSaved('Task deleted.'); }
    catch (err) { setError(err.message); setBusy(false); }
  }
  return <SpaceDialog title={task ? 'Edit task' : 'Create a task'} onClose={onClose} busy={busy}>
    {source && <SpaceSourceSnippet message={source} />}
    <form className="space-form" onSubmit={save}>
      <label>What needs to happen?<input autoFocus required maxLength={240} placeholder="e.g. Book the train tickets" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      {canAssign ? <label>Assign to<select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Anyone · shared checklist</option>
        {members.filter((member) => member.status === 'joined').map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select></label> : <p className="space-muted">{task?.assignee_id ? 'Assigned to ' + nameOf(members, task.assignee_id) + '. Only group admins can change the assignment.' : 'This is a shared checklist item. Only group admins can assign it to a person.'}</p>}
      <label>Due date <span className="space-optional">Optional</span><input type="date" name="due_date" defaultValue={task?.due_date || ''} /></label>
      {error && <p className="space-error" role="alert">{error}</p>}
      {conflict && <button type="button" className="connection-secondary" onClick={onExisting}>View existing task</button>}
      <button className="small-primary" disabled={busy || conflict || !title.trim()}>{busy ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button>
    </form>
    {task && <div className="space-delete-action">{deleting ? <><p>Delete this task? The original message will stay in the chat.</p><button type="button" className="space-danger" disabled={busy} onClick={remove}>Delete task</button><button type="button" className="text-button" disabled={busy} onClick={() => setDeleting(false)}>Keep task</button></> : <button type="button" className="text-button" onClick={() => setDeleting(true)}>Delete task</button>}</div>}
  </SpaceDialog>;
}

export function SpaceDecisionForm({ spaceId, source, onClose, onSaved, onExisting }) {
  const [body, setBody] = useState(source ? messagePreview(source.body)?.slice(0, 2000) || source.attachment?.name || '' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useTransientMessage('', 8000);
  const [conflict, setConflict] = useState(false);
  async function save(event) {
    event.preventDefault(); if (busy || !body.trim()) return;
    setBusy(true); setError('');
    try {
      const id = await spaceRpc('save_space_decision', { p_space_id: spaceId, p_body: body.trim(), p_source_message_id: source?.id || null });
      if (source) {
        const snapshot = await spaceRpc('get_space', { p_space_id: spaceId });
        if (snapshot.decisions.find((item) => item.id === id)?.body !== body.trim()) {
          setConflict(true); setBusy(false); setError('A decision is already pinned from this message. Your draft is still here. Review the existing decision first.'); return;
        }
      }
      onSaved('Decision pinned.');
    }
    catch (err) { setError(err.message); setBusy(false); }
  }
  return <SpaceDialog title="Pin a decision" onClose={onClose} busy={busy}>
    <p className="space-dialog-intro">Write down what the group agreed on so everyone can find it later.</p>
    {source && <SpaceSourceSnippet message={source} />}
    <form className="space-form" onSubmit={save}>
      <label>The decision<textarea autoFocus required maxLength={2000} rows={4} placeholder="e.g. We’re travelling on 15 December. Budget: ₹6,000 each." value={body} onChange={(event) => setBody(event.target.value)} /></label>
      {error && <p className="space-error" role="alert">{error}</p>}
      {conflict && <button type="button" className="connection-secondary" onClick={onExisting}>View existing decision</button>}
      <button className="small-primary" disabled={busy || conflict || !body.trim()}>{busy ? 'Pinning…' : 'Pin decision'}</button>
    </form>
  </SpaceDialog>;
}

export function SpaceLinkForm({ spaceId, source, existingLinks = [], onClose, onSaved }) {
  const links = source ? spaceMessageLinks(source.body) : [];
  const [url, setUrl] = useState(links[0] || '');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useTransientMessage('', 8000);
  async function save(event) {
    event.preventDefault(); if (busy) return;
    const safeUrl = safeSpaceUrl(url.trim());
    if (!safeUrl) { setError('Enter a valid http or https link without sign-in details.'); return; }
    setBusy(true); setError('');
    const stored = existingLinks.find((link) => safeSpaceUrl(link.url) === safeUrl);
    try { await spaceRpc('save_space_link', { p_space_id: spaceId, p_url: stored?.url || url.trim(), p_title: title.trim() || new URL(safeUrl).hostname, p_source_message_id: source?.id || null }); onSaved('Link saved.'); }
    catch (err) { setError(err.message); setBusy(false); }
  }
  return <SpaceDialog title="Save a link" onClose={onClose} busy={busy}><form className="space-form" onSubmit={save}>
    {links.length > 1 && <label>Link from this message<select value={url} onChange={(event) => setUrl(event.target.value)}>{links.map((link) => <option key={link} value={link}>{link}</option>)}</select></label>}
    <label>Link<input autoFocus type="url" required maxLength={2048} placeholder="https://…" value={url} onChange={(event) => setUrl(event.target.value)} /></label>
    <label>Label <span className="space-optional">Optional</span><input maxLength={180} placeholder="e.g. Hotel shortlist" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
    <p className="space-muted">Find it in the group’s Media, files and links page.</p>
    {error && <p className="space-error" role="alert">{error}</p>}<button className="small-primary" disabled={busy}>{busy ? 'Saving…' : 'Save link'}</button>
  </form></SpaceDialog>;
}

export function SpaceMessageActions({ message, task, decision, canAssign = false, onClose, onChoose }) {
  return <SpaceDialog title="Organize this message" onClose={onClose}>
    <SpaceSourceSnippet message={message} />
    <div className="space-action-list">
      <button onClick={() => onChoose(task ? 'task-list' : 'task')}><strong>{task ? 'View task' : 'Create task'}</strong><span>{canAssign ? 'Give it an assignee and an optional due date' : 'Add it to the shared checklist'}</span></button>
      <button onClick={() => onChoose(decision ? 'decision-list' : 'decision')}><strong>{decision ? 'View decision' : 'Pin as a decision'}</strong><span>Keep an agreement easy to find</span></button>
      {spaceMessageLinks(message.body).length > 0 && <button onClick={() => onChoose('link')}><strong>Save to links</strong><span>Add a helpful label to a shared link</span></button>}
    </div>
  </SpaceDialog>;
}

export function SpaceOriginalMessage({ messageId, members, onClose }) {
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    getSupabase().from('space_messages').select('*').eq('id', messageId).maybeSingle().then(({ data, error: err }) => {
      if (!live) return;
      if (err || !data) setError('The original message is no longer available to you.');
      else setMessage(data);
    });
    return () => { live = false; };
  }, [messageId]);
  return <SpaceDialog title="Original message" onClose={onClose}>
    {error && <p className="space-error" role="alert">{error}</p>}
    {!error && !message && <p className="space-muted" role="status">Loading message…</p>}
    {message && <div className="space-original"><strong>{nameOf(members, message.sender_id)}</strong><time>{new Date(message.created_at).toLocaleString()}</time><SpaceMessageBody message={message} /></div>}
  </SpaceDialog>;
}

export function SpaceTasks({ tasks, members, userId, isAdmin = false, initialMine = false, focusTaskId, onCreate, onEdit, onSource, onUpdated, onError }) {
  const [mine, setMine] = useState(initialMine);
  const [busy, setBusy] = useState(null);
  const visible = tasks.filter((task) => !mine || task.assignee_id === userId);
  const open = visible.filter((task) => !task.completed_at);
  const done = visible.filter((task) => task.completed_at);
  useEffect(() => {
    if (!focusTaskId) return;
    const row = document.getElementById('space-task-' + focusTaskId);
    row?.scrollIntoView({ block: 'center' });
    row?.focus({ preventScroll: true });
  }, [focusTaskId]);
  async function toggle(task) {
    if (busy) return; setBusy(task.id);
    try { await spaceRpc('set_space_task_done', { p_task_id: task.id, p_done: !task.completed_at }); await onUpdated(); }
    catch (err) { onError(err.message); }
    finally { setBusy(null); }
  }
  function row(task) {
    const canComplete = !task.assignee_id || task.assignee_id === userId || isAdmin;
    return <article className={'space-task-row' + (task.completed_at ? ' completed' : '')} key={task.id} id={'space-task-' + task.id} tabIndex={-1}>
      <label className="space-task-check" title={canComplete ? undefined : 'Only the assignee or a group admin can update this task'}><input type="checkbox" checked={Boolean(task.completed_at)} disabled={Boolean(busy) || !canComplete} onChange={() => toggle(task)} aria-label={(task.completed_at ? 'Reopen task: ' : 'Complete task: ') + task.title} /></label>
      <div className="space-task-body"><strong>{task.title}</strong><div className="space-task-meta"><span>{task.assignee_id === userId ? 'Assigned to you' : task.assignee_id ? nameOf(members, task.assignee_id) : 'Anyone'}</span>
        {task.due_date && !task.completed_at && <span className={taskDueLabel(task.due_date).startsWith('Overdue') ? 'space-overdue' : ''}>{taskDueLabel(task.due_date)}</span>}
        {task.completed_at && <span>Done {dateLabel(task.completed_at)}</span>}</div>
        {task.source_message_id && <button className="space-source-link" onClick={() => onSource(task.source_message_id)}>View message ↗</button>}
      </div>
      {(task.created_by === userId || isAdmin) && <button type="button" className="space-edit-button" aria-label={'Edit task: ' + task.title} onClick={() => onEdit(task)}>Edit</button>}
    </article>;
  }
  return <section className="space-tool-page" aria-label="Shared tasks">
    <header className="space-tool-heading"><div><h2>One step at a time.</h2><p>A shared checklist for the things that need doing.</p></div><button className="small-primary" onClick={onCreate}>＋ Add task</button></header>
    <div className="space-task-filters" role="group" aria-label="Filter tasks"><button aria-pressed={!mine} onClick={() => setMine(false)}>All tasks</button><button aria-pressed={mine} onClick={() => setMine(true)}>Assigned to me</button><span>{open.length} open</span></div>
    {open.length ? <div className="space-task-list">{open.map(row)}</div> : <div className="space-tool-empty"><span className="space-empty-mark" aria-hidden="true">✓</span><h3>{mine ? 'You’re all caught up.' : tasks.length ? 'Everything’s checked off.' : 'Give your plan a next step.'}</h3><p>{mine ? 'Tasks assigned to you will appear here.' : tasks.length ? 'Add a task when something else needs doing.' : 'Add a task here, or turn a chat message into one using its ··· menu.'}</p></div>}
    {done.length > 0 && <details className="space-completed"><summary>Completed ({done.length})</summary>{done.map(row)}</details>}
    <p className="space-footnote">Admins assign tasks. Assigned tasks can be checked off by the assignee or an admin. Everyone can update shared checklist items.</p>
  </section>;
}

export function SpaceDecisions({ decisions, members, userId, ownerId, onCreate, onSource, onPoll, onPolls, onUpdated, onError }) {
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (busy) return; setBusy(true);
    try { await spaceRpc('remove_space_decision', { p_decision_id: removing.id }); await onUpdated(); setRemoving(null); }
    catch (err) { onError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="space-tool-page" aria-label="Pinned decisions">
    <header className="space-tool-heading"><div><h2>What we’ve agreed.</h2><p>Pin an agreement directly, or take a vote first.</p></div><button className="small-primary" onClick={onCreate}>＋ Pin decision</button></header>
    {!decisions.length && <div className="space-tool-empty"><span className="space-empty-mark" aria-hidden="true">◇</span><h3>Keep everyone on the same page.</h3><p>When the group agrees on something, pin it here or use a message’s ··· menu.</p><button className="connection-secondary" onClick={onPolls}>Take a vote first →</button></div>}
    <div className="space-decision-list">{decisions.map((decision) => <article className="space-decision-card" key={decision.id}>
      <div className="space-decision-label"><span>Pinned decision</span>{[decision.created_by, ownerId].includes(userId) && <button type="button" aria-label="Unpin decision" className="space-edit-button" onClick={() => setRemoving(decision)}>Unpin</button>}</div>
      <p>{decision.body}</p>
      {decision.poll_result_snapshot && <p className="space-decision-vote-summary">From a poll · {decision.poll_result_snapshot.total_votes} {decision.poll_result_snapshot.total_votes === 1 ? 'vote' : 'votes'} cast{decision.poll_result_snapshot.options.filter((option) => option.votes === Math.max(...decision.poll_result_snapshot.options.map((value) => value.votes))).length > 1 ? ' · Chosen after a tie' : ''}</p>}
      <footer><span>{nameOf(members, decision.created_by)} · {dateLabel(decision.created_at)}</span>{decision.source_message_id && <button className="space-source-link" onClick={() => onSource(decision.source_message_id)}>View message ↗</button>}{decision.source_poll_id && <button className="space-source-link" onClick={() => onPoll(decision.source_poll_id)}>View poll & results ↗</button>}</footer>
    </article>)}</div>
    {removing && <SpaceDialog title="Unpin this decision?" onClose={() => setRemoving(null)} busy={busy}><p className="space-dialog-intro">It will leave the Decisions page. The original chat message will stay.</p><div className="space-confirm-actions"><button className="space-danger" disabled={busy} onClick={remove}>{busy ? 'Unpinning…' : 'Unpin decision'}</button><button className="connection-secondary" disabled={busy} onClick={() => setRemoving(null)}>Keep decision</button></div></SpaceDialog>}
  </section>;
}
