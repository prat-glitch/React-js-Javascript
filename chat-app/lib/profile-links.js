const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isProfileToken = (value) => typeof value === 'string' && TOKEN.test(value);

export function profileLink(token, origin) {
  if (!isProfileToken(token)) return '';
  try { return new URL('/connect/' + token.toLowerCase(), origin).href; } catch { return ''; }
}

export function parseProfileLink(value, origin) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  const text = value.trim();
  if (isProfileToken(text)) return text.toLowerCase();
  try {
    const base = new URL(origin);
    const url = new URL(text, base);
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== base.origin ||
      url.username || url.password || url.search || url.hash) return null;
    const match = url.pathname.match(/^\/connect\/([^/]+)\/?$/);
    return match && isProfileToken(match[1]) ? match[1].toLowerCase() : null;
  } catch { return null; }
}

export function validDisplayName(value) {
  if (typeof value !== 'string') return false;
  const name = value.trim();
  return [...name].length >= 2 && [...name].length <= 60 &&
    !name.includes('@') && !/[0-9][0-9 ()+.-]{5,}[0-9]/.test(name);
}

export const validPrivatePhone = (value) => typeof value === 'string' && /^\+?[0-9]{7,15}$/.test(value);

export function connectionMessage(status) {
  return {
    available: 'Send a chat request. You can message each other after they accept.',
    self: 'This is your own profile. Share your QR code or link with someone else.',
    pending_outgoing: 'Request sent. Waiting for them to accept before you can chat.',
    pending_incoming: 'This person has requested to chat with you. Accept only if you want to connect.',
    connected: 'You are connected and can chat.',
    declined: 'This chat request was declined. You cannot send messages to this person.',
    cancelled: 'This request was cancelled. Please wait 24 hours before sending another request.',
  }[status] || 'This request is no longer available. Refresh and try again.';
}
