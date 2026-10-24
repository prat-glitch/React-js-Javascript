'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadSpaceAttachment } from '../lib/space-client';
import { formatFileSize, safeSpaceUrl, trimSpaceLink } from '../lib/spaces';
import { parseGifMessage } from '../lib/message-content';

export function SpaceAttachment({ attachment, thumbnail = false }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const urlRef = useRef('');
  const loadingRef = useRef(false);
  const liveRef = useRef(true);
  const image = attachment.mime.startsWith('image/');
  const video = attachment.mime.startsWith('video/');
  const audio = attachment.mime.startsWith('audio/');
  const load = useCallback(async () => {
    if (loadingRef.current || urlRef.current) return;
    loadingRef.current = true; setBusy(true); setError('');
    try {
      const blob = await downloadSpaceAttachment(attachment);
      if (!liveRef.current) return;
      // Use an inert media MIME. Documents are only offered as downloads.
      const objectUrl = URL.createObjectURL(new Blob([blob], { type: attachment.mime }));
      urlRef.current = objectUrl;
      setUrl(objectUrl);
    } catch (err) { if (liveRef.current) setError(err.message); }
    finally { loadingRef.current = false; if (liveRef.current) setBusy(false); }
  }, [attachment]);
  useEffect(() => {
    liveRef.current = true;
    return () => { liveRef.current = false; if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, []);
  useEffect(() => {
    if (!image) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, { rootMargin: '120px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [image, load]);
  async function download() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const blob = await downloadSpaceAttachment(attachment);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl; link.download = attachment.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div ref={ref} className={'space-attachment' + (thumbnail ? ' space-attachment-thumbnail' : '')}>
    {image && url && <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={attachment.name} /></a>}
    {video && url && <video controls playsInline preload="metadata" src={url} aria-label={attachment.name} />}
    {audio && url && <audio controls preload="metadata" src={url} aria-label={attachment.name} />}
    {(video || audio) && !url && <button type="button" className="space-media-play" disabled={busy} onClick={load}>{busy ? 'Loading…' : video ? '▷ Play video' : '▷ Play audio'}</button>}
    <div className="space-file-row"><span className="space-file-type" aria-hidden="true">{attachment.name.split('.').pop()?.slice(0, 4).toUpperCase()}</span>
      <span><strong>{attachment.name}</strong><small>{formatFileSize(attachment.size)}</small></span>
      <button type="button" className="space-file-download" aria-label={'Download ' + attachment.name} disabled={busy} onClick={download}>{busy ? '…' : '↓'}</button></div>
    {error && <p className="space-error" role="status">{error} {image && <button className="text-button" onClick={load}>Retry preview</button>}</p>}
  </div>;
}

export function SpaceMessageBody({ message }) {
  const gif = parseGifMessage(message.body);
  if (gif) return <div className="space-message-content"><img className="space-gif" src={gif.url} alt={gif.title} loading="lazy" />{gif.text && <p>{gif.text}</p>}</div>;
  const parts = (message.body || '').split(/(https?:\/\/[^\s<>"']+)/gi);
  return <div className="space-message-content">
    {message.attachment && <SpaceAttachment key={message.attachment.path} attachment={message.attachment} />}
    {message.body && <p>{parts.map((part, index) => {
      const candidate = trimSpaceLink(part);
      const suffix = part.slice(candidate.length);
      const url = safeSpaceUrl(candidate);
      return url ? <span key={index}><a href={url} target="_blank" rel="noreferrer">{candidate}</a>{suffix}</span> : part;
    })}</p>}
  </div>;
}

export default function SpaceMessage({ message, mine, onAction, decision, task }) {
  if (message.kind === 'system') return <p className="space-system-message" title={new Date(message.created_at).toLocaleString()}>{message.body}</p>;
  return <article className={'space-message' + (mine ? ' mine' : '')} id={'space-message-' + message.id}>
    <div className="space-message-bubble">
      {!mine && <strong className="space-sender">{message.sender_name}</strong>}
      <SpaceMessageBody message={message} />
      <footer><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
        <button type="button" className="space-message-menu" aria-label={'Actions for message from ' + (mine ? 'you' : message.sender_name)} aria-haspopup="dialog" onClick={() => onAction(message)}>···</button></footer>
    </div>
    {(decision || task) && <div className="space-message-saved">
      {decision && <button type="button" onClick={() => onAction(message, 'decision-list')}>Pinned decision</button>}
      {task && <button type="button" onClick={() => onAction(message, 'task-list')}>{task.completed_at ? 'Task completed' : 'Task created'}</button>}
    </div>}
  </article>;
}
