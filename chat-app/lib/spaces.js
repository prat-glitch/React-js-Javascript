export const SPACE_FILE_LIMIT = 20 * 1024 * 1024;
export const SPACE_FILE_TYPES = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'image/gif': ['gif'],
  'video/mp4': ['mp4'], 'video/webm': ['webm'], 'audio/mpeg': ['mp3'], 'audio/ogg': ['ogg'],
  'application/pdf': ['pdf'], 'text/plain': ['txt'], 'application/zip': ['zip'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
};
export const SPACE_FILE_ACCEPT = Object.values(SPACE_FILE_TYPES).flat().map((ext) => '.' + ext).join(',');

export function spaceFileType(file) {
  const extension = file?.name?.split('.').pop()?.toLowerCase();
  // The extension fallback covers document pickers that omit MIME types.
  return Object.entries(SPACE_FILE_TYPES).find(([mime, extensions]) =>
    extensions.includes(extension) && (!file.type || file.type === mime || file.type === 'application/octet-stream'))?.[0] || null;
}

export function validateSpaceFile(file) {
  if (!file || !file.name || file.name.length > 180 || /[\p{Cc}/\\]/u.test(file.name)) return 'Choose a file with a shorter, valid name.';
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > SPACE_FILE_LIMIT) return 'Choose a file between 1 byte and 20 MB.';
  if (!spaceFileType(file)) return 'Choose an image, video, MP3, OGG, PDF, text, Office document, or ZIP file.';
  return '';
}

export function safeSpaceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\p{Cc}\s]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function spaceMessageLinks(body) {
  if (typeof body !== 'string' || body.startsWith('samlap:gif:v1:')) return [];
  return [...new Set((body.match(/https?:\/\/[^\s<>"']+/gi) || []).map((url) => safeSpaceUrl(trimSpaceLink(url))).filter(Boolean))];
}

export function trimSpaceLink(value) {
  let url = value.replace(/[.,!?:;]+$/, '');
  const pairs = { ')': '(', ']': '[', '}': '{' };
  while (pairs[url.at(-1)]) {
    const close = url.at(-1), open = pairs[close];
    if (url.split(close).length <= url.split(open).length) break;
    url = url.slice(0, -1).replace(/[.,!?:;]+$/, '');
  }
  return url;
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  return bytes < 1024 * 1024 ? (bytes / 1024).toFixed(0) + ' KB' : (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function localDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function taskDueLabel(value, today = localDateKey()) {
  if (!value) return '';
  if (value === today) return 'Due today';
  const date = new Date(value + 'T12:00:00');
  return (value < today ? 'Overdue · ' : 'Due ') + date.toLocaleDateString([], { day: 'numeric', month: 'short', ...(value.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}) });
}

export function mergeSpaceMessages(existing, incoming) {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
