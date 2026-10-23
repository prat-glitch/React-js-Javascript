'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { searchGifLibrary } from '../lib/gif-library';
import { isGiphyGifUrl } from '../lib/message-content';

function GifResult({ gif, onSelect }) {
  const [failed, setFailed] = useState(false);
  return <button type="button" className="gif-result" disabled={failed} onClick={() => onSelect(gif)} aria-label={'Choose ' + gif.title}>
    {failed ? <span className="gif-result-label">Image unavailable</span> : <img src={gif.url} alt={gif.title} width={gif.width} height={gif.height} loading="lazy" onError={() => setFailed(true)} />}
    <span className="gif-result-label">{gif.title}</span>
  </button>;
}

export default function GifPicker({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [source, setSource] = useState('library');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setResults([]);
    const timer = setTimeout(async () => {
      try {
        const { data: { session } } = await getSupabase().auth.getSession();
        const response = await fetch('/api/gifs?q=' + encodeURIComponent(query.trim()), {
          headers: { Authorization: 'Bearer ' + session?.access_token },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(7000)]),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load GIFs. Try again.');
        if (!Array.isArray(data.gifs) || data.gifs.some((gif) => !gif?.id || typeof gif.title !== 'string' || !isGiphyGifUrl(gif.url))) throw new Error('Invalid GIF response');
        if (!controller.signal.aborted) {
          setResults(data.gifs);
          setSource(data.source || 'giphy');
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults(searchGifLibrary(query));
          setSource('library');
          setError('Live search is unavailable. You can still choose a reaction GIF.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, retry]);

  return <div className="gif-picker">
    <label className="gif-search">Search GIFs
      <input autoFocus value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} placeholder={source === 'library' ? 'Search reactions: hello, love, thanks…' : 'Search GIPHY…'} />
    </label>
    {!loading && source === 'library' && <p className="gif-library-note">Reaction library · try hello, love, happy, thanks or cat.</p>}
    <div className="gif-results" aria-live="polite" aria-busy={loading}>
      {loading && <p className="picker-status">Loading GIFs…</p>}
      {error && <div className="gif-fallback-note"><p>{error}</p><button type="button" className="text-button" onClick={() => setRetry(retry + 1)}>Retry live search</button></div>}
      {!loading && results.length === 0 && <p className="picker-status">{source === 'library' ? 'No matching reactions. Try hello, love, happy, thanks or cat.' : 'No GIFs found. Try another search.'}</p>}
      {results.map((gif) => <GifResult key={gif.id + gif.url} gif={gif} onSelect={onSelect} />)}
    </div>
    <a className="giphy-credit" href="https://giphy.com" target="_blank" rel="noreferrer">Powered by GIPHY</a>
  </div>;
}
