import { cn } from '@shared/lib/utils';
import { Separator } from '@shared/ui/separator';
import { ArrowUpRight, CircleDot, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

interface FooterLink {
  label: string;
  href: string;
  prefetch?: boolean | null;
}

const appLinks: FooterLink[] = [
  { label: 'Markets', href: '/' },
  { label: 'Earn', href: '/mint' },
  { label: 'Trade', href: '/trade' },
  { label: 'Pools', href: '/pools' },
  { label: 'Portfolio', href: '/portfolio' },
];

const referenceLinks: FooterLink[] = [
  { label: 'Docs', href: '/docs', prefetch: false },
  { label: 'Risks', href: '/docs/risks', prefetch: false },
  { label: 'Mechanics', href: '/docs/mechanics', prefetch: false },
  { label: 'FAQ', href: '/docs/faq', prefetch: false },
];

const legalLinks: FooterLink[] = [
  { label: 'Terms', href: '/terms', prefetch: false },
  { label: 'Privacy', href: '/privacy', prefetch: false },
];

function InlineLinks({
  label,
  links,
  className,
}: {
  label: string;
  links: FooterLink[];
  className?: string;
}): React.ReactNode {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-normal">
        {label}
      </span>
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            prefetch={link.prefetch ?? null}
            className="text-foreground hover:text-primary text-sm transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Footer(): React.ReactNode {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border mt-16 border-t">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr] lg:items-start">
          <div className="min-w-0">
            <Link href="/" className="text-foreground text-sm font-semibold">
              Horizon Protocol
            </Link>
            <p className="text-muted-foreground mt-2 max-w-lg text-sm">
              Starknet yield tokenization for fixed yield, yield trading, and PT/SY liquidity.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="border-border bg-muted/40 text-muted-foreground inline-flex h-7 items-center gap-1 rounded-full border px-2">
                <CircleDot className="size-3 text-primary" aria-hidden="true" />
                Alpha protocol
              </span>
              <span className="border-border bg-muted/40 text-muted-foreground inline-flex h-7 items-center gap-1 rounded-full border px-2">
                <ShieldCheck className="size-3" aria-hidden="true" />
                User risk review required
              </span>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <InlineLinks label="App" links={appLinks} />
            <InlineLinks label="Reference" links={referenceLinks} />
            <InlineLinks label="Policies" links={legalLinks} />
          </div>
        </div>

        <Separator className="my-6" />

        <div className="text-muted-foreground flex flex-col justify-between gap-3 text-sm sm:flex-row sm:items-center">
          <p>&copy; {currentYear} Horizon Protocol.</p>
          <a
            href="https://starknet.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground inline-flex w-fit items-center gap-1 transition-colors"
          >
            Built on Starknet
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}
