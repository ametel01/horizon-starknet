import { A, useLocation } from '@solidjs/router';
import { useUIMode } from '@/providers/UIModeProvider';
import { cn } from '@shared/lib/utils';
import { createMemo, For, type JSX } from 'solid-js';

/**
 * Mobile Bottom Navigation
 *
 * Fixed bottom navigation bar for mobile devices with:
 * - 5-item navigation grid (3 in simple mode)
 * - Active state indicators
 * - Safe area padding for notched devices
 * - Glassmorphism backdrop effect
 * - Touch-optimized tap targets (44px+)
 */

/** Home icon */
function HomeIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

/** ArrowRightLeft icon for Trade */
function ArrowRightLeftIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m16 3 4 4-4 4" />
      <path d="M20 7H4" />
      <path d="m8 21-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  );
}

/** PlusCircle icon for Mint */
function PlusCircleIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

/** Droplets icon for Pools */
function DropletsIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
      <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
    </svg>
  );
}

/** Wallet icon for Portfolio */
function WalletIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

interface NavItemProps {
  href: string;
  icon: JSX.Element;
  label: string;
  isActive: boolean;
  primary?: boolean;
}

function NavItem(props: NavItemProps): JSX.Element {
  return (
    <A
      href={props.href}
      class={cn(
        'touch-target flex flex-col items-center justify-center gap-1 py-2 transition-colors',
        'min-h-[56px]', // Ensure touch-friendly height
        props.isActive
          ? 'text-primary'
          : props.primary
            ? 'text-primary/80 hover:text-primary'
            : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <div
        class={cn(
          'flex h-8 w-8 items-center justify-center rounded-xl transition-all',
          props.isActive && 'bg-primary/10 shadow-glow-primary-sm',
          props.primary && !props.isActive && 'bg-primary/5'
        )}
      >
        {props.icon}
      </div>
      <span
        class={cn(
          'text-[10px] font-medium tracking-wide',
          props.isActive && 'text-primary',
          props.primary && !props.isActive && 'text-primary/80'
        )}
      >
        {props.label}
      </span>
    </A>
  );
}

interface NavItemConfig {
  href: string;
  icon: JSX.Element;
  label: string;
  simpleLabel?: string;
  primary?: boolean;
  advancedOnly?: boolean;
}

export function MobileNav(): JSX.Element {
  const location = useLocation();
  const { isSimple } = useUIMode();

  // Check if a link is active
  const isActive = (href: string): boolean => {
    const pathname = location.pathname;
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // Navigation items - simplified for mobile
  // In simple mode, Mint becomes "Earn" and Trade/Pools are hidden
  const navItems = createMemo<NavItemConfig[]>(() => {
    const items: NavItemConfig[] = [
      {
        href: '/',
        icon: <HomeIcon class="h-5 w-5" />,
        label: 'Home',
        simpleLabel: 'Markets',
      },
      {
        href: '/trade',
        icon: <ArrowRightLeftIcon class="h-5 w-5" />,
        label: 'Trade',
        advancedOnly: true,
      },
      {
        href: '/mint',
        icon: <PlusCircleIcon class="h-5 w-5" />,
        label: 'Mint',
        simpleLabel: 'Earn',
        primary: true, // Center action button
      },
      {
        href: '/pools',
        icon: <DropletsIcon class="h-5 w-5" />,
        label: 'Pools',
        advancedOnly: true,
      },
      {
        href: '/portfolio',
        icon: <WalletIcon class="h-5 w-5" />,
        label: 'Portfolio',
      },
    ];

    return items.filter((item) => !item.advancedOnly || !isSimple());
  });

  return (
    <nav class="fixed right-0 bottom-0 left-0 z-50 md:hidden" aria-label="Mobile navigation">
      {/* Glassmorphism container */}
      <div class="bg-background/80 border-border supports-[backdrop-filter]:bg-background/60 border-t backdrop-blur-xl">
        {/* Navigation grid */}
        <div
          class={cn('grid gap-1 px-2 py-1', isSimple() ? 'grid-cols-3' : 'grid-cols-5')}
          role="menubar"
        >
          <For each={navItems()}>
            {(item) => (
              <NavItem
                href={item.href}
                icon={item.icon}
                label={isSimple() && item.simpleLabel ? item.simpleLabel : item.label}
                isActive={isActive(item.href)}
                primary={item.primary ?? false}
              />
            )}
          </For>
        </div>

        {/* Safe area padding for notched devices (iPhone X+) */}
        <div class="h-safe-area-bottom bg-background/80" />
      </div>
    </nav>
  );
}
