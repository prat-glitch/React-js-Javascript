export const normalizePhone = (value) => {
  const text = String(value || '').trim();
  const digits = text.replace(/\D/g, '');
  return digits ? (text.startsWith('+') ? '+' : '') + digits : '';
};

export const normalizeMessage = (value) => String(value || '').trim();
