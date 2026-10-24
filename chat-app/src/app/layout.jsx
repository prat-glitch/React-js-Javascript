import './globals.css';
import './midnight.css';
import './theme-controls.css';
import './connections.css';
import './responsive.css';
import './spaces.css';
import './typing.css';
import Script from 'next/script';
import ThemeProvider from '../../components/ThemeProvider';
import { themeInitScript } from '../../lib/theme';

export const metadata = {
  title: 'Samlap',
  description: 'Simple, friendly messaging with Samlap',
  manifest: '/manifest.json',
  referrer: 'no-referrer',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
  themeColor: '#edf4ff',
  colorScheme: 'light',
};

export default function RootLayout({ children }) {
  return <html lang="en" data-theme="light" suppressHydrationWarning>
    <head><Script id="samlap-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
    <body><ThemeProvider>{children}</ThemeProvider></body>
  </html>;
}
