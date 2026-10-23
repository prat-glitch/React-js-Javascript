import { notFound } from 'next/navigation';
import ChatApp from '../../../../components/ChatApp';
import { isProfileToken } from '../../../../lib/profile-links';

export const metadata = { title: 'Connect on Samlap', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function ConnectPage({ params }) {
  const { token } = await params;
  if (!isProfileToken(token)) notFound();
  return <ChatApp inviteToken={token.toLowerCase()} />;
}
