export const TYPING_IDLE_MS = 3000;
export const TYPING_THROTTLE_MS = 2000;

// Serialize requests: a slow start must never arrive after the final stop.
// This controller receives only a boolean, never a draft or individual keystrokes.
export function createTypingSession({ publish, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let active = false, disposed = false, timer, lastSent = -Infinity;
  let pending = Promise.resolve();
  function send(value) {
    pending = pending.catch(() => {}).then(() => publish(value)).catch(() => {});
  }
  function stop() {
    clearTimer(timer);
    if (active) { active = false; lastSent = -Infinity; send(false); }
  }
  return {
    activity(hasText) {
      if (disposed) return;
      if (!hasText) { stop(); return; }
      if (!active || now() - lastSent >= TYPING_THROTTLE_MS) {
        active = true; lastSent = now(); send(true);
      }
      clearTimer(timer);
      timer = setTimer(stop, TYPING_IDLE_MS);
    },
    stop,
    dispose() { disposed = true; stop(); },
  };
}

export function typingLabel(names) {
  if (!names.length) return '';
  if (names.length === 1) return names[0] + ' is typing…';
  if (names.length === 2) return names.join(' and ') + ' are typing…';
  return names.slice(0, 2).join(', ') + ' and ' + (names.length - 2) + (names.length === 3 ? ' other are' : ' others are') + ' typing…';
}
