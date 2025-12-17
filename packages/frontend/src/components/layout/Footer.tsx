import Link from 'next/link';

import { Separator } from '@/components/ui/separator';

const footerLinks = {
  product: {
    title: 'Product',
    links: [
      { label: 'Markets', href: '/' },
      { label: 'Trade', href: '/trade' },
      { label: 'Pools', href: '/pools' },
      { label: 'Portfolio', href: '/portfolio' },
    ],
  },
  learn: {
    title: 'Learn',
    links: [
      { label: 'Documentation', href: '/docs/what-is-horizon' },
      { label: 'Getting Started', href: '/docs/getting-started' },
      { label: 'Guides', href: '/docs/guides' },
      { label: 'FAQ', href: '/docs/faq' },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { label: 'Glossary', href: '/docs/glossary' },
      { label: 'Risks', href: '/docs/risks' },
      { label: 'Mechanics', href: '/docs/mechanics' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
    ],
  },
};

function FooterLinkGroup({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}): React.ReactNode {
  return (
    <div>
      <h3 className="text-foreground mb-3 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer(): React.ReactNode {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border mt-16 border-t">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {/* Main footer content */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand section */}
          <div className="lg:col-span-1">
            <Link href="/" className="text-foreground text-lg font-bold">
              Horizon
            </Link>
            <p className="text-muted-foreground mt-2 text-sm">
              Yield tokenization protocol on Starknet. Split yield-bearing assets into Principal and
              Yield Tokens.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:col-span-1 lg:col-span-4 lg:grid-cols-4">
            <FooterLinkGroup {...footerLinks.product} />
            <FooterLinkGroup {...footerLinks.learn} />
            <FooterLinkGroup {...footerLinks.resources} />
            <FooterLinkGroup {...footerLinks.legal} />
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bottom section */}
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-muted-foreground text-sm">
            &copy; {currentYear} Horizon Protocol. All rights reserved.
          </p>
          <p className="text-muted-foreground text-sm">
            Built on{' '}
            <a
              href="https://starknet.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              Starknet
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
