'use client';

import { useCallback, useEffect, useState } from 'react';

/** Like useState for messages, with a fresh dismissal timer on every set. */
export function useTransientMessage(initial = '', durationMs = 5000) {
  const [message, updateMessage] = useState(() => ({
    value: typeof initial === 'function' ? initial() : initial,
    key: 0,
  }));
  const setMessage = useCallback((next) => {
    updateMessage((current) => ({
      value: typeof next === 'function' ? next(current.value) : next,
      key: current.key + 1,
    }));
  }, []);

  useEffect(() => {
    if (!message.value) return;
    const delay = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 5000;
    const timer = setTimeout(() => {
      // An expired timer must never clear a newer message awaiting its effect.
      updateMessage((current) => current.key === message.key ? { ...current, value: '' } : current);
    }, delay);
    return () => clearTimeout(timer);
  }, [message, durationMs]);

  return [message.value, setMessage];
}
