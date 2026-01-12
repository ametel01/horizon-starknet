import { A, useLocation } from '@solidjs/router';
import { ConnectButton } from '@features/wallet';
import { useUIMode } from '@/providers/UIModeProvider';
import { cn } from '@shared/lib/utils';
import { Button } from '@shared/ui/Button';
import { ThemeToggle } from '@shared/layout/ThemeToggle';
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
  type JSX,
} from 'solid-js';

interface NavLink {
  href: string;
  label: string;
  simpleLabel?: string;
  advancedOnly?: boolean;
}

const navLinks: NavLink[] = [
  { href: '/', label: 'Dashboard', simpleLabel: 'Markets' },
  { href: '/mint', label: 'Mint', simpleLabel: 'Earn' },
  { href: '/trade', label: 'Trade', advancedOnly: true },
  { href: '/pools', label: 'Pools', advancedOnly: true },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/docs', label: 'Docs' },
];

/** Hamburger menu icon */
function MenuIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

/** Close icon for mobile menu */
function CloseIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface ModeToggleProps {
  class?: string;
}

/** Simple/Advanced mode toggle with onboarding tooltip */
function ModeToggle(props: ModeToggleProps): JSX.Element {
  const { mode, toggleMode, hasSeenOnboarding, dismissOnboarding } = useUIMode();
  const [showTooltip, setShowTooltip] = createSignal(false);

  // Show tooltip after a short delay for first-time users
  createEffect(() => {
    if (!hasSeenOnboarding()) {
      const timer = setTimeout(() => {
        setShowTooltip(true);
      }, 1000);
      onCleanup(() => clearTimeout(timer));
    }
  });

  // Auto-hide tooltip after 10 seconds
  createEffect(() => {
    if (showTooltip()) {
      const timer = setTimeout(() => {
        dismissOnboarding();
        setShowTooltip(false);
      }, 10000);
      onCleanup(() => clearTimeout(timer));
    }
  });

  const handleToggle = (): void => {
    toggleMode();
    setShowTooltip(false);
  };

  const handleDismiss = (): void => {
    dismissOnboarding();
    setShowTooltip(false);
  };

  return (
    <div class={cn('relative flex items-center gap-1.5', props.class)}>
      {/* Onboarding Tooltip */}
      <Show when={showTooltip()}>
        <div class="animate-in fade-in slide-in-from-top-2 absolute top-full right-0 z-50 mt-2 w-64 duration-200">
          <div class="bg-card border-border rounded-lg border p-3 shadow-lg">
            <div class="mb-2 flex items-start justify-between">
              <span class="text-foreground text-sm font-medium">Interface Mode</span>
              <button
                type="button"
                onClick={handleDismiss}
                class="text-muted-foreground hover:text-foreground -mt-1 -mr-1 p-1"
                aria-label="Dismiss"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <p class="text-muted-foreground text-xs">
              <span class="text-primary font-medium">Simple</span> mode shows straightforward yield
              earning. <span class="text-primary font-medium">Advanced</span> unlocks full protocol
              features like trading and liquidity.
            </p>
            {/* Arrow */}
            <div class="bg-card border-border absolute -top-2 right-8 h-4 w-4 rotate-45 border-t border-l" />
          </div>
        </div>
      </Show>

      {/* Toggle Button */}
      <button
        type="button"
        onClick={handleToggle}
        class={cn(
          'relative flex h-8 items-center overflow-hidden rounded-full border p-0.5 transition-colors',
          'border-border bg-muted',
          showTooltip() && 'ring-primary/50 ring-2'
        )}
        aria-label={`Switch to ${mode() === 'simple' ? 'advanced' : 'simple'} mode`}
      >
        {/* Background pill that slides */}
        <span
          class={cn(
            'bg-primary absolute h-7 rounded-full transition-all duration-200 ease-in-out',
            mode() === 'simple' ? 'left-0.5 w-[4rem]' : 'left-[4.125rem] w-[5.25rem]'
          )}
        />

        {/* Simple label */}
        <span
          class={cn(
            'relative z-10 px-3 py-1.5 text-xs font-medium transition-colors',
            mode() === 'simple' ? 'text-primary-foreground' : 'text-muted-foreground'
          )}
        >
          Simple
        </span>

        {/* Advanced label */}
        <span
          class={cn(
            'relative z-10 px-3 py-1.5 text-xs font-medium transition-colors',
            mode() === 'advanced' ? 'text-primary-foreground' : 'text-muted-foreground'
          )}
        >
          Advanced
        </span>
      </button>
    </div>
  );
}

export function Header(): JSX.Element {
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const { isSimple } = useUIMode();
  const location = useLocation();

  // Check if a link is active (exact match for home, prefix match for others)
  const isActive = (href: string): boolean => {
    const pathname = location.pathname;
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // Filter and transform nav links based on mode
  const visibleLinks = () =>
    navLinks
      .filter((link) => !link.advancedOnly || !isSimple())
      .map((link) => ({
        ...link,
        displayLabel: isSimple() && link.simpleLabel ? link.simpleLabel : link.label,
      }));

  return (
    <header class="bg-background/80 border-border sticky top-0 z-50 border-b backdrop-blur-sm">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div class="flex items-center gap-8">
          <A href="/" class="flex items-center gap-2 text-xl font-bold">
            <div class="h-9 w-10 overflow-hidden">
              <img
                src="/logo-64.png"
                alt="Horizon"
                width={40}
                height={48}
                class="h-12 w-10 object-cover object-top"
              />
            </div>
            <span>Horizon</span>
          </A>
          <nav class="hidden items-center gap-1 md:flex">
            <For each={visibleLinks()}>
              {(link) => {
                const active = () => isActive(link.href);
                return (
                  <A
                    href={link.href}
                    class={cn(
                      'relative px-3 py-2 text-sm font-medium transition-colors',
                      active() ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {link.displayLabel}
                    <Show when={active()}>
                      <span class="bg-primary absolute inset-x-1 -bottom-[1.125rem] h-0.5 rounded-full" />
                    </Show>
                  </A>
                );
              }}
            </For>
          </nav>
        </div>

        <div class="flex items-center gap-3">
          <ThemeToggle />
          <ModeToggle class="hidden sm:flex" />
          <ConnectButton />

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            class="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen())}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen()}
          >
            <Show when={mobileMenuOpen()} fallback={<MenuIcon />}>
              <CloseIcon />
            </Show>
          </Button>
        </div>
      </div>

      {/* Mobile navigation */}
      <Show when={mobileMenuOpen()}>
        <nav class="border-border bg-background border-t px-4 py-4 md:hidden">
          <div class="flex flex-col gap-1">
            <For each={visibleLinks()}>
              {(link) => {
                const active = () => isActive(link.href);
                return (
                  <A
                    href={link.href}
                    class={cn(
                      'rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                      active()
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.displayLabel}
                  </A>
                );
              }}
            </For>
            <div class="border-border mt-2 border-t pt-4 sm:hidden">
              <div class="flex items-center justify-between px-4">
                <span class="text-muted-foreground text-sm">Interface Mode</span>
                <ModeToggle />
              </div>
            </div>
          </div>
        </nav>
      </Show>
    </header>
  );
}
