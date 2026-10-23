export const THEME_STORAGE_KEY = 'samlap-theme';
export const THEME_COLORS = { light: '#edf4ff', dark: '#0b1120' };

// Restore the saved appearance before hydration so dark mode does not flash light.
export const themeInitScript = `
  try {
    document.documentElement.dataset.theme =
      localStorage.getItem('${THEME_STORAGE_KEY}') === 'dark' ? 'dark' : 'light';
  } catch {
    document.documentElement.dataset.theme = 'light';
  }
`;
