'use client';

import { ConnectButton, useStarknet } from '@features/wallet';
import { ModeToggle } from '@shared/layout/mode-toggle';
import { ThemeToggle } from '@shared/layout/theme-toggle';
import { cn } from '@shared/lib/utils';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { Button } from '@shared/ui/Button';
import {
  Activity,
  ArrowRightLeft,
  BookOpen,
  CircleDot,
  Droplets,
  LayoutDashboard,
  type LucideIcon,
  Menu,
  PlusCircle,
  WalletCards,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavLink {
  href: string;
  label: string;
  simpleLabel?: string;
  advancedOnly?: boolean;
  icon: LucideIcon;
}

const navLinks: NavLink[] = [
  { href: '/', label: 'Dashboard', simpleLabel: 'Markets', icon: LayoutDashboard },
  { href: '/mint', label: 'Mint', simpleLabel: 'Earn', icon: PlusCircle },
  { href: '/trade', label: 'Trade', advancedOnly: true, icon: ArrowRightLeft },
  { href: '/pools', label: 'Pools', advancedOnly: true, icon: Droplets },
  { href: '/portfolio', label: 'Portfolio', icon: WalletCards },
  { href: '/docs', label: 'Docs', icon: BookOpen },
];

const networkLabels = {
  mainnet: 'Mainnet',
  sepolia: 'Sepolia',
  devnet: 'Devnet',
  fork: 'Fork',
} as const;

export function Header(): React.ReactNode {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isSimple } = useUIMode();
  const { network, isConnected } = useStarknet();
  const pathname = usePathname();
  const networkLabel = networkLabels[network];
  const modeLabel = isSimple ? 'Simple' : 'Advanced';
  const walletLabel = isConnected ? 'Wallet connected' : 'Wallet disconnected';

  const isActive = (href: string): boolean => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const visibleLinks: Array<NavLink & { displayLabel: string }> = [];
  for (const link of navLinks) {
    if (link.advancedOnly && isSimple) {
      continue;
    }
    visibleLinks.push({
      ...link,
      displayLabel: isSimple && link.simpleLabel ? link.simpleLabel : link.label,
    });
  }

  return (
    <header className="bg-background/90 border-border sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="flex min-h-14 items-center justify-between gap-2 py-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2"
              aria-label="Horizon dashboard"
            >
              <div className="h-8 w-9 shrink-0 overflow-hidden">
                <Image
                  src="/logo-64.png"
                  alt=""
                  width={36}
                  height={43}
                  className="h-[43px] w-9 object-cover object-top"
                  priority
                />
              </div>
              <span className="hidden text-sm font-semibold tracking-normal min-[360px]:inline">
                Horizon
              </span>
            </Link>

            <div className="hidden items-center gap-1.5 text-xs min-[540px]:flex">
              <span className="border-border bg-muted/50 text-muted-foreground inline-flex h-7 items-center gap-1 rounded-full border px-2">
                <CircleDot className="size-3 text-primary" aria-hidden="true" />
                {networkLabel}
              </span>
              <span className="border-border bg-muted/50 text-muted-foreground hidden h-7 items-center rounded-full border px-2 lg:inline-flex">
                {modeLabel} mode
              </span>
            </div>
          </div>

          <nav
            className="bg-muted/40 ring-border/70 hidden items-center gap-0.5 rounded-full p-1 ring-1 min-[920px]:flex"
            aria-label="Primary navigation"
          >
            {visibleLinks.map((link) => {
              const active = isActive(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {link.displayLabel}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span
              className={cn(
                'hidden h-7 items-center gap-1 rounded-full px-2 text-xs min-[760px]:inline-flex',
                isConnected
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted/60 text-muted-foreground ring-border/70 ring-1'
              )}
            >
              <Activity className="size-3" aria-hidden="true" />
              {walletLabel}
            </span>
            <ThemeToggle />
            <ModeToggle className="hidden min-[560px]:flex" />
            <div className="max-[359px]:[&_[data-slot=button]]:px-2 max-[359px]:[&_[data-slot=button]]:text-xs">
              <ConnectButton />
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              className="min-[920px]:hidden"
              onClick={() => {
                setMobileMenuOpen(!mobileMenuOpen);
              }}
              aria-label={mobileMenuOpen ? 'Close app menu' : 'Open app menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Menu className="size-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          className="border-border bg-background/95 border-t px-3 py-3 backdrop-blur-xl min-[920px]:hidden"
          aria-label="App menu"
        >
          <div className="mx-auto grid max-w-7xl gap-3">
            <div className="text-muted-foreground grid grid-cols-3 gap-2 text-xs">
              <span className="border-border bg-muted/40 inline-flex min-w-0 items-center justify-center gap-1 rounded-md border px-2 py-2">
                <CircleDot className="size-3 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">{networkLabel}</span>
              </span>
              <span className="border-border bg-muted/40 inline-flex min-w-0 items-center justify-center rounded-md border px-2 py-2">
                <span className="truncate">{modeLabel}</span>
              </span>
              <span className="border-border bg-muted/40 inline-flex min-w-0 items-center justify-center rounded-md border px-2 py-2">
                <span className="truncate">{isConnected ? 'Connected' : 'No wallet'}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {visibleLinks.map((link) => {
                const active = isActive(link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    onClick={() => {
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{link.displayLabel}</span>
                  </Link>
                );
              })}
            </div>

            <div className="border-border flex items-center justify-between gap-3 border-t pt-3 min-[560px]:hidden">
              <span className="text-muted-foreground text-sm">Interface</span>
              <ModeToggle />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
