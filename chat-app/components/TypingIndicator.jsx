import { typingLabel } from '../lib/typing';

export default function TypingIndicator({ names }) {
  const label = typingLabel(names);
  return <div className="typing-indicator" role="status" aria-live="polite" aria-atomic="true">
    {label && <><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span><span>{label}</span></>}
  </div>;
}
