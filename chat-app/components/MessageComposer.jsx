'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useTransientMessage } from '../lib/useTransientMessage';
import { encodeGifMessage } from '../lib/message-content';
import GifPicker from './GifPicker';
import { useTheme } from './ThemeProvider';
import { SPACE_FILE_ACCEPT, formatFileSize, validateSpaceFile } from '../lib/spaces';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => <p className="picker-status">Loading emojis…</p>,
});

export default function MessageComposer({ onSend, sending, allowAttachments = false, onTypingChange }) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState('');
  const [gif, setGif] = useState(null);
  const [file, setFile] = useState(null);
  const [picker, setPicker] = useState(null);
  const [error, setError] = useTransientMessage('', 8000);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const emojiButtonRef = useRef(null);
  const gifButtonRef = useRef(null);
  const maxLength = gif ? 10000 - encodeGifMessage(gif).length : 10000;

  useEffect(() => {
    if (!picker) return;
    const outside = (event) => { if (!rootRef.current?.contains(event.target)) setPicker(null); };
    const escape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPicker(null);
        (picker === 'emoji' ? emojiButtonRef : gifButtonRef).current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [picker]);

  function addEmoji({ emoji }) {
    const { start, end } = selectionRef.current;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    if (next.length > maxLength) return;
    setDraft(next);
    onTypingChange?.(Boolean(next.trim()));
    const position = start + emoji.length;
    selectionRef.current = { start: position, end: position };
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(position, position);
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (sending || (!draft.trim() && !gif && !file)) return;
    const body = gif ? encodeGifMessage(gif, draft) : draft.trim();
    if (body.length > 10000) { setError('This message is too long. Shorten the text and try again.'); return; }
    setError('');
    setPicker(null);
    onTypingChange?.(false);
    if (await onSend(body, file)) {
      setDraft('');
      setGif(null);
      setFile(null);
      selectionRef.current = { start: 0, end: 0 };
      inputRef.current?.focus();
    }
  }

  return <div className="composer-dock" ref={rootRef}>
    {picker && <section id="message-picker" className="message-picker" role="dialog" aria-label={picker === 'emoji' ? 'Choose an emoji' : 'Choose a GIF'}>
      <header className="picker-header"><strong>{picker === 'emoji' ? 'Emojis' : 'GIFs'}</strong><button type="button" className="picker-close" aria-label="Close picker" onClick={() => { setPicker(null); (picker === 'emoji' ? emojiButtonRef : gifButtonRef).current?.focus(); }}>×</button></header>
      {picker === 'emoji' ? <EmojiPicker colorScheme={theme} onEmojiClick={addEmoji} emojiStyle="native" width="100%" height={340} previewConfig={{ showPreview: false }} /> : <GifPicker onSelect={(selected) => { setGif(selected); setPicker(null); inputRef.current?.focus(); }} />}
    </section>}
    {gif && <div className="gif-attachment"><img src={gif.url} alt={gif.title} /><span>GIF ready to send</span><button type="button" disabled={sending} className="text-button" aria-label="Remove GIF" onClick={() => setGif(null)}>×</button></div>}
    {allowAttachments && <input ref={fileRef} className="space-file-input" type="file" tabIndex={-1} aria-label="Choose a file to attach" accept={SPACE_FILE_ACCEPT} disabled={sending} onChange={(event) => {
      const selected = event.target.files?.[0];
      event.target.value = '';
      if (!selected) return;
      const invalid = validateSpaceFile(selected);
      setError(invalid);
      if (!invalid) { setFile(selected); setPicker(null); }
    }} />}
    {file && <div className="space-file-draft"><span><strong>{file.name}</strong><small>{formatFileSize(file.size)} · {sending ? 'Sending…' : 'Ready to send'}</small></span>
      <button type="button" className="icon-button" aria-label="Remove attachment" disabled={sending} onClick={() => setFile(null)}>×</button></div>}
    {error && <p className="composer-error" role="alert">{error}</p>}
    <form className={'composer' + (allowAttachments ? ' space-composer' : '')} onSubmit={submit}>
      {allowAttachments && <button type="button" className="composer-tool" aria-label="Attach a file" title="Attach a file (up to 20 MB)" disabled={sending || Boolean(gif)} onClick={() => fileRef.current?.click()}>＋</button>}
      <button ref={emojiButtonRef} type="button" className="composer-tool emoji-toggle" disabled={sending} aria-label="Choose emoji" title="Emojis" aria-expanded={picker === 'emoji'} aria-controls={picker === 'emoji' ? 'message-picker' : undefined} aria-haspopup="dialog" onClick={() => setPicker(picker === 'emoji' ? null : 'emoji')}>☺</button>
      <button ref={gifButtonRef} type="button" className="composer-tool gif-toggle" disabled={sending || Boolean(file)} aria-label="Choose GIF" title="GIFs" aria-expanded={picker === 'gif'} aria-controls={picker === 'gif' ? 'message-picker' : undefined} aria-haspopup="dialog" onClick={() => setPicker(picker === 'gif' ? null : 'gif')}>GIF</button>
      <input ref={inputRef} aria-label="Message" value={draft} disabled={sending} onChange={(event) => { setDraft(event.target.value); onTypingChange?.(Boolean(event.target.value.trim())); }} onBlur={() => onTypingChange?.(false)} onSelect={(event) => { selectionRef.current = { start: event.target.selectionStart, end: event.target.selectionEnd }; }} placeholder="Write a message…" maxLength={maxLength} />
      <button className="send-button" disabled={(!draft.trim() && !gif && !file) || sending} title="Send message" aria-label="Send message">➤</button>
    </form>
  </div>;
}
