'use client';

import { cn } from '@shared/lib/utils';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { ArrowRightLeft, Droplets, Home, PlusCircle, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Mobile Bottom Navigation
 *
 * Fixed bottom navigation bar for mobile devices with:
 * - 5-item navigation grid
 * - Active state indicators
 * - Safe area padding for notched devices
 * - Glassmorphism backdrop effect
 * - Touch-optimized tap targets (44px+)
 */

interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  isActive: boolean;
  primary?: boolean | undefined;
}

function NavItem({ href, icon, label, isActive, primary }: NavItemProps): ReactNode {
  return (
    <Link
      href={href}
      className={cn(
        'touch-target flex flex-col items-center justify-center gap-1 py-2 transition-colors',
        'min-h-[56px]', // Ensure touch-friendly height
        isActive
          ? 'text-primary'
          : primary
            ? 'text-primary/80 hover:text-primary'
            : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <div
        className={cn(
          'flex size-8 items-center justify-center rounded-xl transition-all',
          isActive && 'bg-primary/10 shadow-glow-primary-sm',
          primary && !isActive && 'bg-primary/5'
        )}
      >
        {icon}
      </div>
      <span
        className={cn(
          'text-[10px] font-medium tracking-wide',
          isActive && 'text-primary',
          primary && !isActive && 'text-primary/80'
        )}
      >
        {label}
      </span>
    </Link>
  );
}

export function MobileNav(): ReactNode {
  const pathname = usePathname();
  const { isSimple } = useUIMode();

  // Check if a link is active
  const isActive = (href: string): boolean => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // Navigation items - simplified for mobile
  // In simple mode, Mint becomes "Earn" and Trade/Pools are hidden
  const navItems = [
    {
      href: '/',
      icon: <Home className="size-5" />,
      label: isSimple ? 'Markets' : 'Home',
    },
    ...(isSimple
      ? []
      : [
          {
            href: '/trade',
            icon: <ArrowRightLeft className="size-5" />,
            label: 'Trade',
          },
        ]),
    {
      href: '/mint',
      icon: <PlusCircle className="size-5" />,
      label: isSimple ? 'Earn' : 'Mint',
      primary: true, // Center action button
    },
    ...(isSimple
      ? []
      : [
          {
            href: '/pools',
            icon: <Droplets className="size-5" />,
            label: 'Pools',
          },
        ]),
    {
      href: '/portfolio',
      icon: <Wallet className="size-5" />,
      label: 'Portfolio',
    },
  ];

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-50 md:hidden" aria-label="Mobile navigation">
      {/* Glassmorphism container */}
      <div className="bg-background/80 border-border supports-[backdrop-filter]:bg-background/60 border-t backdrop-blur-xl">
        {/* Navigation grid */}
        <div className={cn('grid gap-1 px-2 py-1', isSimple ? 'grid-cols-3' : 'grid-cols-5')}>
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={isActive(item.href)}
              primary={item.primary}
            />
          ))}
        </div>

        {/* Safe area padding for notched devices (iPhone X+) */}
        <div className="h-safe-area-bottom bg-background/80" />
      </div>
    </nav>
  );
}
