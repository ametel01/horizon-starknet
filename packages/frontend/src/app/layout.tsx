import type { Metadata } from 'next';
import { JetBrains_Mono, Outfit, Sora } from 'next/font/google';

import { Providers } from '@/providers';
import { Footer } from '@shared/layout/Footer';
import { Header } from '@shared/layout/Header';
import { MobileNav } from '@shared/layout/MobileNav';
import { Toaster } from '@shared/ui/sonner';
import { IndexerStatusBanner } from '@widgets/analytics/IndexerStatusBanner';

import './globals.css';

// Display font: Modern geometric for headlines and hero text
const displayFont = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

// Body font: Modern geometric sans with excellent readability
const bodyFont = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Mono font: Perfect for numbers, addresses, and data
const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const siteUrl = 'https://splityield.org';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Horizon Protocol | Yield Tokenization on Starknet',
    template: '%s | Horizon Protocol',
  },
  description:
    'Split yield-bearing assets into Principal and Yield Tokens on Starknet. Earn fixed yields, trade yield exposure, and provide liquidity.',
  keywords: [
    'DeFi',
    'Starknet',
    'yield tokenization',
    'principal token',
    'yield token',
    'fixed yield',
    'AMM',
    'liquidity',
  ],
  authors: [{ name: 'Horizon Protocol' }],
  creator: 'Horizon Protocol',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Horizon Protocol',
    title: 'Horizon Protocol | Yield Tokenization on Starknet',
    description:
      'Split yield-bearing assets into Principal and Yield Tokens. Earn fixed yields or speculate on variable rates.',
    images: [
      {
        url: '/logo-128.png',
        width: 128,
        height: 128,
        alt: 'Horizon Protocol',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Horizon Protocol',
    description: 'Yield tokenization protocol on Starknet',
    images: ['/logo-128.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/logo-64.png', type: 'image/png', sizes: '64x64' },
    ],
    apple: '/logo-128.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): React.ReactNode {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Preconnect to external origins used early in page lifecycle */}
        <link rel="preconnect" href="https://starknet-mainnet.g.alchemy.com" />
        <link rel="preconnect" href="https://starknet.impulse.avnu.fi" />
        {/* Preconnect to Google Fonts for faster font loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          <Header />
          <IndexerStatusBanner showOnlyIssues={true} className="mx-4 mt-2" />
          <main className="pb-mobile-nav min-h-[calc(100vh-4rem)]">{children}</main>
          <Footer />
          <MobileNav />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
