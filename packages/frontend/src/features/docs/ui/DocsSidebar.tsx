'use client';

import { cn } from '@shared/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  title: string;
  href?: string;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    title: 'What is Horizon',
    href: '/docs/what-is-horizon',
  },
  {
    title: 'How It Works',
    href: '/docs/how-it-works',
    children: [
      { title: 'Yield Tokens', href: '/docs/how-it-works/yield-tokens' },
      { title: 'AMM Mechanics', href: '/docs/how-it-works/amm-mechanics' },
    ],
  },
  {
    title: 'Getting Started',
    href: '/docs/getting-started',
  },
  {
    title: 'Guides',
    href: '/docs/guides',
    children: [
      { title: 'Earn Fixed Yield', href: '/docs/guides/earn-fixed-yield' },
      { title: 'Trade Yield', href: '/docs/guides/trade-yield' },
      { title: 'Provide Liquidity', href: '/docs/guides/provide-liquidity' },
      { title: 'Manage Positions', href: '/docs/guides/manage-positions' },
      { title: 'Analytics', href: '/docs/guides/analytics' },
    ],
  },
  {
    title: 'Mechanics',
    href: '/docs/mechanics',
    children: [
      { title: 'Pricing', href: '/docs/mechanics/pricing' },
      { title: 'APY Calculation', href: '/docs/mechanics/apy-calculation' },
      { title: 'Redemption', href: '/docs/mechanics/redemption' },
      { title: 'Flash Mint', href: '/docs/mechanics/flash-mint' },
    ],
  },
  {
    title: 'Risks',
    href: '/docs/risks',
  },
  {
    title: 'FAQ',
    href: '/docs/faq',
  },
  {
    title: 'Glossary',
    href: '/docs/glossary',
  },
  {
    title: 'Whitepaper',
    href: '/docs/whitepaper',
  },
];

interface NavItemProps {
  item: NavItem;
  level?: number;
}

function NavItemComponent({ item, level = 0 }: NavItemProps): React.ReactNode {
  const pathname = usePathname();
  const isActive = pathname === item.href;
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const isChildActive = hasChildren && children.some((child) => pathname === child.href);

  const [isOpen, setIsOpen] = useState(isActive || isChildActive);

  const handleToggle = (): void => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div>
      <div className="flex items-center">
        {hasChildren && (
          <button
            type="button"
            onClick={handleToggle}
            className="text-muted-foreground hover:text-foreground mr-1 p-0.5"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
        {item.href ? (
          <Link
            href={item.href}
            prefetch={false} // Disable prefetch for docs sidebar - many links, ISR cached
            className={cn(
              'block flex-1 rounded-md px-2 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              !hasChildren && 'ml-5'
            )}
          >
            {item.title}
          </Link>
        ) : (
          <span
            className={cn('block flex-1 px-2 py-1.5 text-sm font-medium', !hasChildren && 'ml-5')}
          >
            {item.title}
          </span>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="border-border mt-1 ml-4 space-y-1 border-l pl-2">
          {children.map((child) => (
            <NavItemComponent key={child.href} item={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DocsSidebar(): React.ReactNode {
  return (
    <nav className="space-y-1">
      {navigation.map((item) => (
        <NavItemComponent key={item.href ?? item.title} item={item} />
      ))}
    </nav>
  );
}

export type { NavItem };
// Export navigation for use in prev/next navigation
export { navigation };
