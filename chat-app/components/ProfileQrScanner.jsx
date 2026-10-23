'use client';

import { useEffect, useRef, useState } from 'react';
import { parseProfileLink } from '../lib/profile-links';

export default function ProfileQrScanner({ onFound, onClose }) {
  const dialogRef = useRef(null);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const closedRef = useRef(false);
  const foundRef = useRef(false);
  const [status, setStatus] = useState('Scan a Samlap profile QR code, or choose a saved QR image.');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    closedRef.current = false;
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    return () => {
      closedRef.current = true;
      scannerRef.current?.destroy();
    };
  }, []);

  function readResult(result) {
    if (closedRef.current || foundRef.current) return;
    const token = parseProfileLink(result.data, window.location.origin);
    if (!token) { setStatus('This QR code is not a profile link from this Samlap app.'); return; }
    foundRef.current = true;
    scannerRef.current?.stop();
    onFound(token);
  }

  async function startCamera() {
    if (starting) return;
    setStarting(true);
    try {
      const { default: QrScanner } = await import('qr-scanner');
      if (closedRef.current) return;
      scannerRef.current?.destroy();
      const scanner = new QrScanner(videoRef.current, readResult, {
        preferredCamera: 'environment', returnDetailedScanResult: true,
      });
      scannerRef.current = scanner;
      await scanner.start();
      if (closedRef.current) { scanner.destroy(); return; }
      setStatus('Point your camera at a Samlap profile QR code.');
    } catch {
      if (!closedRef.current) setStatus('Camera unavailable. Allow camera access over HTTPS, or choose a QR image instead.');
    } finally { if (!closedRef.current) setStarting(false); }
  }

  async function readImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setStatus('Choose a QR image smaller than 10 MB.'); return; }
    try {
      const { default: QrScanner } = await import('qr-scanner');
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      readResult(result);
    } catch { if (!closedRef.current) setStatus('No readable QR code found. Try a clearer image.'); }
    event.target.value = '';
  }

  return <dialog ref={dialogRef} className="connection-dialog" aria-labelledby="scan-heading" onClose={onClose}>
    <header className="connection-dialog-header"><h2 id="scan-heading">Scan a profile QR</h2>
      <button type="button" className="icon-button" aria-label="Close scanner" onClick={onClose}>×</button></header>
    <video ref={videoRef} className="qr-video" muted playsInline aria-label="QR camera preview" />
    <p className="connection-status" role="status">{status}</p>
    <button type="button" className="small-primary" onClick={startCamera} disabled={starting}>{starting ? 'Starting camera…' : 'Start camera'}</button>
    <label className="qr-file-label">Or choose a QR image<input type="file" accept="image/*" onChange={readImage} /></label>
    <p className="connection-help">Scanning opens a profile. It does not send a request or accept a chat automatically.</p>
  </dialog>;
}
