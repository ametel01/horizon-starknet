'use client';

import Link from 'next/link';

import { ConnectButton } from '../wallet/ConnectButton';

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/mint', label: 'Mint' },
  { href: '/trade', label: 'Trade' },
  { href: '/pools', label: 'Pools' },
  { href: '/portfolio', label: 'Portfolio' },
] as const;

export function Header(): React.ReactNode {
  return (
    <header className="bg-background/80 sticky top-0 z-50 border-b border-border backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-semibold">
            Horizon
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
