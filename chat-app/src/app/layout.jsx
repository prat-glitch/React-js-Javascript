import './globals.css';

export const metadata = {
  title: 'Samlap',
  description: 'Simple, friendly messaging with Samlap',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
