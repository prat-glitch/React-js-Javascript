'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { connectionMessage, parseProfileLink, profileLink } from '../lib/profile-links';
import ProfileQrScanner from './ProfileQrScanner';

export default function ProfileConnections({ profile, userId, inviteToken, onOpenChat, onRefreshChats }) {
  const [tab, setTab] = useState('connect');
  const [input, setInput] = useState('');
  const [requests, setRequests] = useState([]);
  const [candidate, setCandidate] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [qr, setQr] = useState('');
  const candidateRef = useRef(null);
  const requestRevision = useRef('');
  const lookupRef = useRef(0);
  const incoming = requests.filter((request) => request.direction === 'incoming' && request.status === 'pending');

  const refresh = useCallback(async () => {
    const db = getSupabase();
    const { data, error } = await db.rpc('list_basic_chat_requests');
    if (error) { setStatus('Could not refresh chat requests. Please try again.'); return; }
    setRequests(data || []);
    const revision = (data || []).filter((item) => item.status === 'accepted').map((item) => item.request_id).sort().join(',');
    if (revision !== requestRevision.current) { requestRevision.current = revision; onRefreshChats(); }
    const token = candidateRef.current;
    if (token) {
      const { data: card, error: cardError } = await db.rpc('get_basic_profile_card', { p_share_token: token });
      if (!cardError && candidateRef.current === token) setCandidate(card);
    }
  }, [onRefreshChats]);

  useEffect(() => {
    let live = true;
    setShareUrl(profileLink(profile.share_token, window.location.origin));
    refresh();
    const db = getSupabase();
    const channel = db.channel('profile-requests-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'basic_chat_requests' }, () => { if (live) refresh(); })
      .subscribe();
    const poll = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 10000);
    const focus = () => refresh();
    window.addEventListener('focus', focus);
    return () => { live = false; clearInterval(poll); window.removeEventListener('focus', focus); db.removeChannel(channel); };
  }, [profile.share_token, userId, refresh]);

  useEffect(() => {
    if (!shareUrl || tab !== 'share') return;
    let live = true;
    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(shareUrl, {
      width: 256, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#101828', light: '#ffffff' },
    })).then((url) => { if (live) setQr(url); }).catch(() => { if (live) setStatus('Could not create your QR code. You can still copy your profile link.'); });
    return () => { live = false; };
  }, [shareUrl, tab]);

  const lookup = useCallback(async (token) => {
    const revision = ++lookupRef.current;
    candidateRef.current = token;
    setTab('connect'); setBusy(true); setCandidate(null); setStatus('');
    const { data, error } = await getSupabase().rpc('get_basic_profile_card', { p_share_token: token });
    if (revision !== lookupRef.current) return;
    if (error) setStatus('Could not open this profile. Please try again.');
    else if (!data) { candidateRef.current = null; setStatus('This profile link is invalid or no longer available.'); }
    else setCandidate(data);
    setBusy(false);
  }, []);

  useEffect(() => { if (inviteToken) lookup(inviteToken); }, [inviteToken, lookup]);

  async function openLink(event) {
    event.preventDefault();
    const token = parseProfileLink(input, window.location.origin);
    if (!token) { setStatus('Paste a valid profile link from this Samlap app.'); return; }
    await lookup(token);
  }

  async function requestChat() {
    if (busy || !candidate) return;
    setBusy(true); setStatus('');
    const { data, error } = await getSupabase().rpc('send_basic_chat_request', { p_share_token: candidate.share_token });
    if (error) setStatus(error.message);
    else { setCandidate((card) => ({ ...card, ...data })); await refresh(); }
    setBusy(false);
  }

  async function respond(id, accept) {
    if (busy) return;
    setBusy(true); setStatus('');
    const { data, error } = await getSupabase().rpc('respond_basic_chat_request', { p_request_id: id, p_accept: accept });
    if (error) setStatus(error.message);
    else {
      if (tab === 'requests') setStatus(!accept && data.status === 'declined'
        ? 'Request declined. No new chat was opened.' : connectionMessage(data.status));
      await refresh();
      if (data.status === 'connected' && data.chat_id && accept) await onOpenChat(data.chat_id);
    }
    setBusy(false);
  }

  async function cancel(id) {
    if (busy) return;
    setBusy(true); setStatus('');
    const { data, error } = await getSupabase().rpc('cancel_basic_chat_request', { p_request_id: id });
    if (error) setStatus(error.message);
    else { if (tab === 'requests') setStatus(connectionMessage(data.status)); await refresh(); }
    setBusy(false);
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setStatus('Profile link copied.'); }
    catch { setStatus('Copy the profile link from the field below.'); }
  }

  async function shareProfile() {
    try { await navigator.share({ title: 'Connect with me on Samlap', url: shareUrl }); }
    catch (error) { if (error.name !== 'AbortError') setStatus('Sharing unavailable. Use Copy link instead.'); }
  }

  return <section className="profile-connections" aria-label="Profile links and chat requests">
    <div className="connection-tabs" role="tablist" aria-label="Connect with people">
      {[['connect', 'Connect'], ['requests', 'Requests' + (incoming.length ? ' (' + incoming.length + ')' : '')], ['share', 'My QR']].map(([key, label]) =>
        <button key={key} type="button" id={'connection-tab-' + key} role="tab" aria-selected={tab === key}
          aria-controls="connection-panel" onClick={() => { setTab(key); setStatus(''); }}>{label}</button>)}
    </div>
    <div id="connection-panel" className={'connection-panel' + (tab === 'share' ? ' share-panel' : '')} role="tabpanel" aria-labelledby={'connection-tab-' + tab}>
      {tab === 'connect' && <>
        <form className="connection-link-form" onSubmit={openLink}>
          <label htmlFor="profile-link">Open a profile link</label>
          <input id="profile-link" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Paste a Samlap profile link" maxLength={2048} required />
          <div className="connection-actions"><button type="submit" className="small-primary" disabled={busy}>Open profile</button>
            <button type="button" className="connection-secondary" onClick={() => setScanOpen(true)}>Scan QR</button></div>
        </form>
        {busy && !candidate && <p className="connection-help" role="status">Opening profile…</p>}
        {candidate && <div className="profile-card">
          <div className="connection-person"><span className="avatar">{candidate.display_name.slice(0, 1).toUpperCase()}</span><strong>{candidate.display_name}</strong></div>
          <p className="connection-help">{connectionMessage(candidate.status)}</p>
          {candidate.status === 'available' && <button type="button" className="small-primary" disabled={busy} onClick={requestChat}>Send chat request</button>}
          {candidate.status === 'connected' && <button type="button" className="small-primary" onClick={() => onOpenChat(candidate.chat_id)}>Open chat</button>}
          {candidate.status === 'pending_outgoing' && <button type="button" className="text-button" disabled={busy} onClick={() => cancel(candidate.request_id)}>Cancel request</button>}
          {candidate.status === 'pending_incoming' && <div className="connection-actions">
            <button type="button" className="small-primary" disabled={busy} onClick={() => respond(candidate.request_id, true)}>Accept</button>
            <button type="button" className="connection-secondary" disabled={busy} onClick={() => respond(candidate.request_id, false)}>Decline</button></div>}
        </div>}
      </>}
      {tab === 'requests' && <>
        <div className="request-heading"><strong>Chat requests</strong><button type="button" className="text-button" onClick={refresh}>Refresh</button></div>
        {!requests.length && <p className="connection-help">No requests yet. Share your profile link or QR code to connect.</p>}
        {requests.map((request) => <article key={request.request_id} className="request-item">
          <strong>{request.peer_name}</strong><span className="connection-help">{request.direction === 'incoming' ? 'Incoming' : 'Sent'} · {request.status}</span>
          {request.status === 'pending' && request.direction === 'incoming' && <div className="connection-actions">
            <button type="button" className="small-primary" disabled={busy} onClick={() => respond(request.request_id, true)}>Accept</button>
            <button type="button" className="connection-secondary" disabled={busy} onClick={() => respond(request.request_id, false)}>Decline</button></div>}
          {request.status === 'pending' && request.direction === 'outgoing' && <><p className="connection-help">Waiting for acceptance.</p>
            <button type="button" className="text-button" disabled={busy} onClick={() => cancel(request.request_id)}>Cancel request</button></>}
          {request.status === 'accepted' && <button type="button" className="text-button" onClick={() => onOpenChat(request.chat_id)}>Open chat →</button>}
          {request.status === 'declined' && request.direction === 'outgoing' && <p className="connection-help">Request declined. Messaging is unavailable.</p>}
        </article>)}
      </>}
      {tab === 'share' && <div className="my-profile-share">
        <strong>{profile.display_name}</strong>
        {qr ? <img className="profile-qr" src={qr} alt="QR code for your Samlap profile link" width="256" height="256" /> : <p className="connection-help">Creating your QR code…</p>}
        <label htmlFor="my-profile-link">Your profile link</label><input id="my-profile-link" value={shareUrl} readOnly onFocus={(event) => event.target.select()} />
        <div className="connection-actions"><button type="button" className="small-primary" onClick={copyLink}>Copy link</button>
          <button type="button" className="connection-secondary" onClick={shareProfile}>Share</button>
          {qr && <a className="connection-download" href={qr} download="samlap-profile.png">Save QR</a>}</div>
        <p className="connection-help">Your QR and link show only your display name. Email and phone stay private. You decide which chat requests to accept.</p>
      </div>}
      {status && <p className="connection-status" role="status">{status}</p>}
    </div>
    {scanOpen && <ProfileQrScanner onClose={() => setScanOpen(false)} onFound={(token) => { setScanOpen(false); lookup(token); }} />}
  </section>;
}
