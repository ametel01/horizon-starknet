import { A } from '@solidjs/router';
import { For, type JSX } from 'solid-js';
import { Separator } from '@shared/ui/Separator';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterLinkSection {
  title: string;
  links: FooterLink[];
}

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
} as const satisfies Record<string, FooterLinkSection>;

function FooterLinkGroup(props: FooterLinkSection): JSX.Element {
  return (
    <div>
      <h3 class="text-foreground mb-3 text-sm font-semibold">{props.title}</h3>
      <ul class="space-y-2">
        <For each={props.links}>
          {(link) => (
            <li>
              <A
                href={link.href}
                class="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {link.label}
              </A>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

export function Footer(): JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <footer class="border-border mt-16 border-t">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {/* Main footer content */}
        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand section */}
          <div class="lg:col-span-1">
            <A href="/" class="text-foreground text-lg font-bold">
              Horizon
            </A>
            <p class="text-muted-foreground mt-2 text-sm">
              Yield tokenization protocol on Starknet. Split yield-bearing assets into Principal and
              Yield Tokens.
            </p>
          </div>

          {/* Link columns */}
          <div class="grid grid-cols-2 gap-8 sm:col-span-1 lg:col-span-4 lg:grid-cols-4">
            <FooterLinkGroup {...footerLinks.product} />
            <FooterLinkGroup {...footerLinks.learn} />
            <FooterLinkGroup {...footerLinks.resources} />
            <FooterLinkGroup {...footerLinks.legal} />
          </div>
        </div>

        <Separator class="my-8" />

        {/* Bottom section */}
        <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p class="text-muted-foreground text-sm">
            &copy; {currentYear} Horizon Protocol. All rights reserved.
          </p>
          <p class="text-muted-foreground text-sm">
            Built on{' '}
            <a
              href="https://starknet.io"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:text-primary/80 transition-colors"
            >
              Starknet
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
