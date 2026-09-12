import type { Metadata } from "next";
import "./globals.css";
import { Inter, JetBrains_Mono, Syne } from 'next/font/google';

const headingFont = Syne({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '500', '600', '700', '800'],
});

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: "BitDrum | Make the Call. Beat the Market.",
  description: "Ultra-fast Bitcoin Up/Down prediction markets live on Bot Chain. Oracle-settled. Vault-backed. 1m and 5m windows.",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
    other: [
      { rel: 'icon', url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { rel: 'icon', url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

import dynamic from "next/dynamic";

const Providers = dynamic(
  () => import("@/components/Providers").then(m => ({ default: m.Providers })),
  { ssr: false }
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${headingFont.variable} ${bodyFont.variable} ${monoFont.variable} min-h-screen bg-[var(--bg-primary)] font-body text-[var(--text-primary)] antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
