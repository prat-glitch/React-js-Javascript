'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { spaceRpc } from '../lib/space-client';
import { useTransientMessage } from '../lib/useTransientMessage';
import SpaceDialog from './SpaceDialog';

const nameOf = (members, id) => members.find((member) => member.user_id === id)?.display_name || 'A member';

export function SpacePollForm({ spaceId, onClose, onSaved }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useTransientMessage('', 8000);
  const request = useRef(null);
  async function save(event) {
    event.preventDefault(); if (busy) return;
    const labels = options.map((option) => option.trim());
    if (!question.trim() || labels.some((option) => !option) || new Set(labels.map((option) => option.toLowerCase())).size !== labels.length) {
      setError('Add a question and at least two different, non-empty options.'); return;
    }
    // A network retry keeps its id; an edited draft becomes a new request.
    const signature = JSON.stringify([question.trim(), labels]);
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      await spaceRpc('create_space_poll', { p_space_id: spaceId, p_poll_id: request.current.id, p_question: question.trim(), p_options: labels });
      onSaved('Poll created. Members can vote in Decisions.');
    } catch (err) { setError(err.message); setBusy(false); }
  }
  return <SpaceDialog title="Ask the group" onClose={onClose} busy={busy}>
    <p className="space-dialog-intro">Take a vote, then decide together whether to pin the result.</p>
    <form className="space-form" onSubmit={save}>
      <label>Question<input autoFocus required maxLength={240} placeholder="Which hotel should we book?" value={question} disabled={busy} onChange={(event) => setQuestion(event.target.value)} /></label>
      <fieldset disabled={busy}><legend>Options <span className="space-optional">2–8 choices</span></legend>
        <div className="space-poll-fields">{options.map((option, index) => <div className="space-poll-field" key={index}>
          <input aria-label={'Option ' + (index + 1)} required maxLength={120} placeholder={'Option ' + (index + 1)} value={option} onChange={(event) => setOptions(options.map((value, i) => i === index ? event.target.value : value))} />
          {options.length > 2 && <button type="button" className="space-edit-button" aria-label={'Remove option ' + (index + 1)} onClick={() => setOptions(options.filter((_, i) => i !== index))}>×</button>}
        </div>)}</div>
        {options.length < 8 && <button type="button" className="space-source-link space-poll-add" onClick={() => setOptions([...options, ''])}>＋ Add option</button>}
      </fieldset>
      <p className="space-muted">One vote per member. Votes can be changed until voting closes. Only totals and your own choice are shown. Questions and options stay fixed once published.</p>
      {error && <p className="space-error" role="alert">{error}</p>}
      <button className="small-primary" disabled={busy || !question.trim() || options.some((option) => !option.trim())}>{busy ? 'Creating…' : 'Create poll'}</button>
    </form>
  </SpaceDialog>;
}

export function SpacePollCard({ poll, members, userId, isAdmin, onUpdated, onDecision, onError }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const maximum = Math.max(0, ...poll.options.map((option) => option.votes));
  const leaders = poll.options.filter((option) => option.votes === maximum);
  const [choice, setChoice] = useState('');
  const canManage = poll.created_by === userId || isAdmin;
  const closed = Boolean(poll.closed_at);
  async function run(name, params, notice) {
    if (busy) return;
    setBusy(true);
    try { await spaceRpc(name, params); setConfirm(null); await onUpdated(notice); }
    catch (err) { onError(err.message); }
    finally { setBusy(false); }
  }
  function startDecision() { setChoice(leaders.length === 1 ? leaders[0].id : ''); setConfirm('decision'); }
  return <article className="space-poll-card" aria-label={'Poll: ' + poll.question}>
    <div className="space-poll-top"><span className={'space-poll-status' + (closed ? ' closed' : '')}><i aria-hidden="true" />{closed ? 'Voting closed' : 'Open poll'}</span>{poll.decision_id && <span className="space-poll-pinned">Decision pinned</span>}</div>
    <h3>{poll.question}</h3>
    <p className="space-poll-byline">{nameOf(members, poll.created_by)} · {new Date(poll.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</p>
    <div className="space-poll-options" role="group" aria-label={closed ? 'Final poll results' : 'Choose one option'}>{poll.options.map((option) => {
      const percent = poll.total_votes ? Math.round(option.votes / poll.total_votes * 100) : 0;
      const selected = poll.my_option_id === option.id;
      return <button type="button" className={'space-poll-option' + (selected ? ' selected' : '')} key={option.id} disabled={busy || closed} aria-pressed={selected}
        aria-label={`${option.label}: ${option.votes} ${option.votes === 1 ? 'vote' : 'votes'}, ${percent}%${selected ? ', your vote' : ''}`}
        onClick={() => run('vote_space_poll', { p_poll_id: poll.id, p_option_id: option.id })}>
        <span className="space-poll-fill" style={{ width: percent + '%' }} aria-hidden="true" />
        <span className="space-poll-option-text"><span className="space-poll-radio" aria-hidden="true">{selected ? '✓' : ''}</span><span>{option.label}{selected && <small>Your vote</small>}</span><strong>{percent}%<small>{option.votes} {option.votes === 1 ? 'vote' : 'votes'}</small></strong></span>
      </button>;
    })}</div>
    <div className="space-poll-meta"><span>{poll.total_votes} {poll.total_votes === 1 ? 'vote' : 'votes'} · {closed ? 'Final results' : 'Choose one · change anytime'}</span>
      {!closed && poll.my_option_id && <button className="space-source-link" disabled={busy} onClick={() => run('vote_space_poll', { p_poll_id: poll.id, p_option_id: null })}>Remove my vote</button>}</div>
    {closed && !poll.decision_id && <p className="space-muted space-poll-outcome">{!poll.total_votes ? 'No votes were cast. You can still pin a decision directly.' : leaders.length > 1 ? 'The top choices are tied. Discuss the result before choosing a decision.' : 'Voting is complete. The result stays a poll unless it is pinned as a decision.'}</p>}
    {(canManage || poll.decision_id) && <footer className="space-poll-actions">
      {poll.decision_id ? <button type="button" className="connection-secondary" onClick={onDecision}>View pinned decisions ↗</button> : closed ? canManage && <button type="button" className="connection-secondary" disabled={busy || !poll.total_votes} onClick={startDecision}>Make a decision</button> : canManage && <button type="button" className="space-source-link" disabled={busy} onClick={() => setConfirm('close')}>Close voting</button>}
    </footer>}
    {confirm === 'close' && <SpaceDialog title="Close voting?" onClose={() => setConfirm(null)} busy={busy}>
      <p className="space-dialog-intro">Members won’t be able to add, change, or remove votes. Results will stay available. Closing a poll does not create a decision.</p>
      <div className="space-confirm-actions"><button className="small-primary" disabled={busy} onClick={() => run('close_space_poll', { p_poll_id: poll.id }, 'Voting closed. You can pin a result when the group is ready.')}>{busy ? 'Closing…' : 'Close voting'}</button><button className="connection-secondary" disabled={busy} onClick={() => setConfirm(null)}>Keep voting open</button></div>
    </SpaceDialog>}
    {confirm === 'decision' && <SpaceDialog title="Pin the poll result?" onClose={() => setConfirm(null)} busy={busy}>
      <p className="space-dialog-intro">{leaders.length > 1 ? 'The vote is tied. After discussing it with the group, choose one of the tied options to pin.' : 'Pin the most-voted option as the group’s decision. The final voting results will stay linked to it.'}</p>
      <form className="space-form" onSubmit={(event) => { event.preventDefault(); if (choice) run('decide_space_poll', { p_poll_id: poll.id, p_option_id: choice }, 'Poll result pinned as a decision.'); }}>
        <label>Decision<select required value={choice} disabled={busy} onChange={(event) => setChoice(event.target.value)}><option value="" disabled>Choose the agreed option</option>{leaders.map((option) => <option value={option.id} key={option.id}>{option.label} · {option.votes} {option.votes === 1 ? 'vote' : 'votes'}</option>)}</select></label>
        <button className="small-primary" disabled={busy || !choice}>{busy ? 'Pinning…' : 'Pin decision'}</button>
      </form>
    </SpaceDialog>}
  </article>;
}

export default function SpacePolls({ spaceId, members, userId, isAdmin, onDecision, onUpdated, onNotice }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const live = useRef(false);
  const sequence = useRef(0);
  const known = useRef([]);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const latest = await spaceRpc('list_space_polls', { p_space_id: spaceId, p_limit: 20 });
      const ids = new Set(latest.map((poll) => poll.id));
      const older = await Promise.all(known.current.filter((poll) => !ids.has(poll.id)).map((poll) => spaceRpc('get_space_poll', { p_poll_id: poll.id })));
      if (!live.current || request !== sequence.current) return;
      if (!known.current.length) setHasMore(latest.length === 20);
      known.current = [...latest, ...older]; setPolls(known.current); setError(''); setLoading(false);
    } catch (err) {
      if (!live.current || request !== sequence.current) return;
      setError(err.message); setLoading(false);
      // Never retain group data after membership has been revoked.
      if (/not a (?:joined )?space member|not available to you|permission denied/i.test(err.message)) { known.current = []; setPolls([]); }
    }
  }, [spaceId]);
  useEffect(() => {
    const counter = sequence;
    live.current = true; refresh();
    const db = getSupabase();
    const channel = db.channel('space-polls-' + spaceId).on('postgres_changes', { event: '*', schema: 'public', table: 'space_polls', filter: 'space_id=eq.' + spaceId }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'space_decisions', filter: 'space_id=eq.' + spaceId }, refresh).subscribe();
    const visibleRefresh = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = setInterval(visibleRefresh, 8000);
    window.addEventListener('focus', visibleRefresh); document.addEventListener('visibilitychange', visibleRefresh);
    return () => { live.current = false; counter.current++; clearInterval(timer); db.removeChannel(channel); window.removeEventListener('focus', visibleRefresh); document.removeEventListener('visibilitychange', visibleRefresh); };
  }, [spaceId, refresh]);
  async function more() {
    if (moreBusy || !known.current.length) return;
    setMoreBusy(true); const request = ++sequence.current;
    const cursor = known.current.at(-1);
    try {
      const page = await spaceRpc('list_space_polls', { p_space_id: spaceId, p_before: cursor.created_at, p_before_id: cursor.id, p_limit: 20 });
      if (!live.current || request !== sequence.current) return;
      const ids = new Set(known.current.map((poll) => poll.id));
      known.current = [...known.current, ...page.filter((poll) => !ids.has(poll.id))]; setPolls(known.current); setHasMore(page.length === 20);
    } catch (err) { if (live.current) onNotice(err.message); }
    finally { if (live.current) setMoreBusy(false); }
  }
  async function updated(notice) { await refresh(); onUpdated(); if (notice) onNotice(notice); }
  return <section className="space-tool-page" aria-label="Group polls">
    <header className="space-tool-heading"><div><h2>Hear everyone out.</h2><p>Take a vote. Pin a decision when you’re ready.</p></div><button className="small-primary" onClick={() => setCreating(true)}>＋ Create poll</button></header>
    {error && <div className="space-poll-load-error"><p role="alert" className="space-error">{error}</p><button className="connection-secondary" onClick={refresh}>Try again</button></div>}
    {loading ? <p className="space-muted" role="status">Loading polls…</p> : !error && !polls.length && <div className="space-tool-empty"><span className="space-empty-mark" aria-hidden="true">▥</span><h3>A choice to make?</h3><p>Ask the group about dates, places, or the next step. Voting doesn’t automatically create a decision.</p><button className="connection-secondary" onClick={() => setCreating(true)}>Create your first poll</button></div>}
    <div className="space-poll-list">{polls.map((poll) => <SpacePollCard poll={poll} key={poll.id} members={members} userId={userId} isAdmin={isAdmin} onUpdated={updated} onDecision={onDecision} onError={onNotice} />)}</div>
    {hasMore && <button className="space-load-more text-button" disabled={moreBusy} onClick={more}>{moreBusy ? 'Loading…' : 'Older polls'}</button>}
    {polls.length > 0 && <p className="space-footnote">Anyone can start a poll. Its creator or an admin can close voting and pin a result. Only totals and your own vote are visible. Cast votes remain in the results if a member leaves.</p>}
    {creating && <SpacePollForm spaceId={spaceId} onClose={() => setCreating(false)} onSaved={(notice) => { setCreating(false); updated(notice); }} />}
  </section>;
}

export function SpacePollSource({ pollId, members, userId, isAdmin, onClose, onUpdated, onDecision }) {
  const [poll, setPoll] = useState(null);
  const [error, setError] = useTransientMessage('', 8000);
  const [loadError, setLoadError] = useState('');
  const refresh = useCallback(async () => {
    const result = await spaceRpc('get_space_poll', { p_poll_id: pollId }); setPoll(result);
  }, [pollId]);
  useEffect(() => {
    let live = true;
    spaceRpc('get_space_poll', { p_poll_id: pollId }).then((value) => { if (live) setPoll(value); }).catch((err) => { if (live) setLoadError(err.message); });
    return () => { live = false; };
  }, [pollId]);
  return <SpaceDialog title="Original poll" onClose={onClose}>
    {loadError && <p className="space-error" role="alert">{loadError}</p>}{error && <p className="space-error" role="alert">{error}</p>}
    {!poll && !loadError && <p className="space-muted" role="status">Loading poll…</p>}
    {poll && <SpacePollCard poll={poll} members={members} userId={userId} isAdmin={isAdmin} onUpdated={async () => { await refresh(); onUpdated(); }} onDecision={onDecision} onError={setError} />}
  </SpaceDialog>;
}
