'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { THEME_COLORS, THEME_STORAGE_KEY } from '../lib/theme';

const ThemeContext = createContext(null);

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const saved = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    applyTheme(saved);
    setTheme(saved);

    function syncTheme(event) {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const next = event.newValue === 'dark' ? 'dark' : 'light';
      applyTheme(next);
      setTheme(next);
    }
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* The toggle still works when storage is unavailable. */ }
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';

  return <button type="button" className="theme-toggle" aria-label={label} title={label}
    aria-pressed={dark} onClick={toggleTheme}>
    <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
  </button>;
}
