import { useState, useEffect, useCallback } from 'react';

/**
 * usePWAInstall
 * -----------------------------------------------------------
 * Handles the full PWA install lifecycle:
 *
 *  1. On mount: checks if already running in standalone mode
 *     (display-mode: standalone, or iOS navigator.standalone).
 *     If so, `isInstalled = true` and the Install button should be hidden.
 *
 *  2. Listens for `beforeinstallprompt` → sets `canInstall = true` and
 *     stores the deferred prompt for later use.
 *
 *  3. Listens for `appinstalled` → sets `canInstall = false`, `isInstalled = true`
 *     immediately after the user completes installation.
 *
 * @returns {{ canInstall: boolean, isInstalled: boolean, promptInstall: () => Promise<void> }}
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(
    // Pick up a prompt already captured in main.jsx before React mounted
    () => window.deferredPrompt ?? null
  );
  const [canInstall,  setCanInstall]  = useState(() => !!window.deferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already running as an installed PWA
    const standaloneMedia = window.matchMedia('(display-mode: standalone)');
    if (standaloneMedia.matches || window.navigator.standalone === true) {
      setIsInstalled(true);
      setCanInstall(false);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
      window.deferredPrompt = null;
    };

    // Also listen for standalone mode change (edge case: user installs mid-session)
    const handleStandaloneChange = (e) => {
      if (e.matches) {
        setIsInstalled(true);
        setCanInstall(false);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    standaloneMedia.addEventListener('change', handleStandaloneChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneMedia.removeEventListener('change', handleStandaloneChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setCanInstall(false);
        window.deferredPrompt = null;
      }
    } else {
      // Fallback instructions for browsers that don't support the prompt API
      alert(
        'To install Samlap:\n\n' +
        '💻 PC/Mac: Click the install icon (⊕) in your browser address bar.\n\n' +
        '📱 Android: Tap the browser menu (⋮) → "Add to Home screen".\n\n' +
        '🍎 iPhone/iPad: Tap the Share button (□↑) → "Add to Home Screen".'
      );
    }
  }, [deferredPrompt]);

  return { canInstall, isInstalled, promptInstall };
}
