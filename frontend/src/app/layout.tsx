import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Botrem | Make the Call. Beat the Market.",
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

import { Providers } from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased"
        style={{
          fontFamily: "'Inter', sans-serif",
          '--font-heading': "'Syne', sans-serif",
          '--font-mono': "'JetBrains Mono', monospace",
        } as React.CSSProperties}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
