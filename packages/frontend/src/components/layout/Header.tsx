'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/Button';
import { useUIMode } from '@/contexts/ui-mode-context';

import { ConnectButton } from '../wallet/ConnectButton';

interface NavLink {
  href: string;
  label: string;
  simpleLabel?: string; // Alternative label for simple mode
  advancedOnly?: boolean; // Hide in simple mode
}

const navLinks: NavLink[] = [
  { href: '/', label: 'Dashboard', simpleLabel: 'Markets' },
  { href: '/mint', label: 'Mint', simpleLabel: 'Earn' },
  { href: '/trade', label: 'Trade', advancedOnly: true },
  { href: '/pools', label: 'Pools', advancedOnly: true },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/docs', label: 'Docs' },
];

export function Header(): React.ReactNode {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isSimple } = useUIMode();

  // Filter and transform nav links based on mode
  const visibleLinks = navLinks
    .filter((link) => !link.advancedOnly || !isSimple)
    .map((link) => ({
      ...link,
      displayLabel: isSimple && link.simpleLabel ? link.simpleLabel : link.label,
    }));

  return (
    <header className="bg-background/80 border-border sticky top-0 z-50 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <div className="h-9 w-10 overflow-hidden">
              <Image
                src="/logo-64.png"
                alt="Horizon"
                width={40}
                height={48}
                className="h-12 w-10 object-cover object-top"
                priority
              />
            </div>
            <span>Horizon</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {link.displayLabel}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ModeToggle className="hidden sm:flex" />
          <ConnectButton />

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => {
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <nav className="border-border bg-background border-t px-4 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg px-4 py-3 text-sm transition-colors"
                onClick={() => {
                  setMobileMenuOpen(false);
                }}
              >
                {link.displayLabel}
              </Link>
            ))}
            <div className="border-border mt-2 border-t pt-4 sm:hidden">
              <div className="flex items-center justify-between px-4">
                <span className="text-muted-foreground text-sm">Interface Mode</span>
                <ModeToggle />
              </div>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
