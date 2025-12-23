import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Public_Sans } from 'next/font/google';

import { IndexerStatusBanner } from '@/components/analytics';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/providers';

import './globals.css';

const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-sans' });

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Horizon Protocol',
  description: 'Split yield-bearing assets into Principal and Yield Tokens on Starknet',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/logo-64.png', type: 'image/png', sizes: '64x64' },
    ],
    apple: '/logo-128.png',
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): React.ReactNode {
  return (
    <html lang="en" className={publicSans.variable} suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        <Providers>
          <Header />
          <IndexerStatusBanner showOnlyIssues={true} className="mx-4 mt-2" />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <Footer />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
