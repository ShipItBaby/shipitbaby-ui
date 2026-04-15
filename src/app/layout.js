import { Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ── SEO & Social Metadata ─────────────────────────────────────────────────────
// metadataBase is required so Next.js can generate absolute URLs for OG images.
// Update this to your production domain before going live.
export const metadata = {
  metadataBase: new URL('https://shipit.baby'),

  title: {
    default: 'ShipIt — Trade builders, not memes',
    template: '%s | ShipIt',
  },
  description:
    'A Solana platform where builders launch apps as tradable tokens and ship in public. Speculate on execution — GitHub commits, milestones, demos, and traction.',

  // ── Canonical ──────────────────────────────────────────────────────────────
  alternates: {
    canonical: '/',
  },

  // ── Open Graph ─────────────────────────────────────────────────────────────
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://shipit.baby',
    siteName: 'ShipIt',
    title: 'ShipIt — Trade builders, not memes',
    description:
      'Launch your app as a Solana token. Ship fast. Build reputation. Let traders bet on your execution.',
  },

  // ── Twitter / X Card ───────────────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    site: '@shipit_baby',
    creator: '@shipit_baby',
    title: 'ShipIt — Trade builders, not memes',
    description:
      'Launch your app as a Solana token. Ship fast. Build reputation. Let traders bet on your execution.',
  },

  // ── Indexing hints ─────────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // ── Misc ───────────────────────────────────────────────────────────────────
  keywords: [
    'Solana', 'token', 'builder token', 'ship in public', 'app token',
    'speculate', 'execution', 'crypto', 'web3', 'startup token',
  ],
  authors: [{ name: 'ShipIt', url: 'https://shipit.baby' }],
  creator: 'ShipIt',
};

export const viewport = {
  themeColor: '#0a0a0f',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
