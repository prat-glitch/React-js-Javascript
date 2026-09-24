let audioContext;

export function unlockNotificationSound() {
  if (typeof window === 'undefined') return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  try {
    audioContext ||= new AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
  } catch {
    // Sound is optional; it must never interrupt messaging.
  }
}

export async function playNotificationSound() {
  unlockNotificationSound();
  if (!audioContext) return;
  if (audioContext.state === 'suspended') {
    try { await audioContext.resume(); } catch { return; }
  }
  if (audioContext.state !== 'running') return;
  try {
    const start = audioContext.currentTime;
    for (const [delay, frequency] of [[0, 660], [0.12, 880]]) {
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, start + delay);
      volume.gain.exponentialRampToValueAtTime(0.055, start + delay + 0.015);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.18);
      oscillator.connect(volume);
      volume.connect(audioContext.destination);
      oscillator.start(start + delay);
      oscillator.stop(start + delay + 0.19);
    }
  } catch {
    // Ignore audio-device failures without affecting incoming messages.
  }
}
