'use client';

import { cn } from '@shared/lib/utils';
import { FileText, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SearchResult {
  title: string;
  href: string;
  section?: string;
  excerpt: string;
}

// Search index - contains all doc pages with searchable content
const searchIndex: SearchResult[] = [
  {
    title: 'What is Horizon',
    href: '/docs/what-is-horizon',
    excerpt:
      'Yield tokenization protocol on Starknet. Split yield-bearing assets into Principal Token (PT) and Yield Token (YT).',
  },
  {
    title: 'How It Works',
    href: '/docs/how-it-works',
    excerpt:
      'Deposit yield-bearing tokens, wrap into SY, split into PT and YT. Core rule: PT Price + YT Price = 1 SY.',
  },
  {
    title: 'Yield Tokens',
    href: '/docs/how-it-works/yield-tokens',
    section: 'How It Works',
    excerpt:
      'PT is your guaranteed principal redeemable at maturity. YT collects variable yield until expiry.',
  },
  {
    title: 'AMM Mechanics',
    href: '/docs/how-it-works/amm-mechanics',
    section: 'How It Works',
    excerpt:
      'Specialized market maker for time-decaying assets. YT Price = 1 - PT Price. Implied yield pricing.',
  },
  {
    title: 'Getting Started',
    href: '/docs/getting-started',
    excerpt:
      'Connect Starknet wallet (Ready or Braavos), get STRK for gas, choose Simple or Advanced mode.',
  },
  {
    title: 'Earn Fixed Yield',
    href: '/docs/guides/earn-fixed-yield',
    section: 'Guides',
    excerpt:
      'Lock in guaranteed APY by holding Principal Tokens until maturity. Buy PT at discount, redeem for full value.',
  },
  {
    title: 'Trade Yield',
    href: '/docs/guides/trade-yield',
    section: 'Guides',
    excerpt:
      'Buy or sell exposure to future yield movements. Buy YT for leveraged yield exposure, buy PT for fixed returns.',
  },
  {
    title: 'Provide Liquidity',
    href: '/docs/guides/provide-liquidity',
    section: 'Guides',
    excerpt:
      'Earn trading fees by adding liquidity to PT/SY pools. Returns from swap fees, underlying yield, PT appreciation.',
  },
  {
    title: 'Manage Positions',
    href: '/docs/guides/manage-positions',
    section: 'Guides',
    excerpt:
      'Track holdings, claim yield, redeem tokens. Portfolio overview, claiming YT yield, redemption at maturity.',
  },
  {
    title: 'Pricing',
    href: '/docs/mechanics/pricing',
    section: 'Mechanics',
    excerpt:
      'PT price formula from implied yield. P_PT = 1/(1+r)^t. YT price derived as 1 - PT price.',
  },
  {
    title: 'APY Calculation',
    href: '/docs/mechanics/apy-calculation',
    section: 'Mechanics',
    excerpt: 'Implied APY, fixed APY, LP APY formulas. Understanding yields displayed in Horizon.',
  },
  {
    title: 'Redemption',
    href: '/docs/mechanics/redemption',
    section: 'Mechanics',
    excerpt:
      'PY Index, minting PT/YT from SY, pre-expiry and post-expiry redemption. YT yield collection.',
  },
  {
    title: 'Risks',
    href: '/docs/risks',
    excerpt:
      'Smart contract risk, market risks, underlying asset risks, position-specific risks. Risk management tips.',
  },
  {
    title: 'FAQ',
    href: '/docs/faq',
    excerpt:
      'Common questions about PT, YT, SY, trading, liquidity, maturity, and troubleshooting.',
  },
  {
    title: 'Glossary',
    href: '/docs/glossary',
    excerpt:
      'Key terms: AMM, APY, implied yield, maturity, minting, redemption, slippage, TVL, and more.',
  },
];

function searchDocs(query: string): SearchResult[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery.split(/\s+/).filter(Boolean);

  return searchIndex
    .map((item) => {
      const searchText = `${item.title} ${item.section ?? ''} ${item.excerpt}`.toLowerCase();
      const matchCount = terms.filter((term) => searchText.includes(term)).length;
      return { ...item, matchCount };
    })
    .filter((item) => item.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 8);
}

export function DocsSearch(): React.ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    setResults(searchDocs(value));
    setSelectedIndex(0);
  }, []);

  const handleSelect = useCallback(
    (href: string) => {
      setIsOpen(false);
      setQuery('');
      router.push(href);
    },
    [router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex].href);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [results, selectedIndex, handleSelect]
  );

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  return (
    <>
      {/* Search trigger button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
        }}
        className="border-border bg-muted/50 text-muted-foreground hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search docs...</span>
        <kbd className="border-border bg-background hidden items-center gap-0.5 rounded border px-1.5 py-0.5 font-mono text-xs sm:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Search dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
          {/* Backdrop */}
          <div
            className="bg-background/80 fixed inset-0 backdrop-blur-sm"
            onClick={() => {
              setIsOpen(false);
            }}
          />

          {/* Dialog */}
          <div className="border-border bg-card relative mx-4 w-full max-w-lg rounded-lg border shadow-lg">
            {/* Search input */}
            <div className="border-border flex items-center gap-3 border-b px-4 py-3">
              <Search className="text-muted-foreground h-5 w-5" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  handleSearch(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search documentation..."
                className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[300px] overflow-y-auto p-2">
              {query && results.length === 0 && (
                <div className="text-muted-foreground px-4 py-8 text-center">
                  No results found for &quot;{query}&quot;
                </div>
              )}

              {results.map((result, index) => (
                <Link
                  key={result.href}
                  href={result.href}
                  prefetch={false} // Disable prefetch - dynamic results, user picks one
                  onClick={() => {
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={cn(
                    'flex items-start gap-3 rounded-md px-3 py-2 transition-colors',
                    index === selectedIndex ? 'bg-primary/10 ring-primary ring-1' : 'hover:bg-muted'
                  )}
                >
                  <FileText
                    className={cn(
                      'mt-0.5 h-5 w-5 flex-shrink-0',
                      index === selectedIndex ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'truncate font-medium',
                          index === selectedIndex && 'text-primary'
                        )}
                      >
                        {result.title}
                      </span>
                      {result.section && (
                        <span className="text-muted-foreground text-xs">{result.section}</span>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-sm">{result.excerpt}</p>
                  </div>
                </Link>
              ))}

              {!query && (
                <div className="text-muted-foreground px-4 py-6 text-center text-sm">
                  <p>Type to search documentation</p>
                  <p className="mt-2 text-xs">
                    Use <kbd className="border-border rounded border px-1">↑</kbd>{' '}
                    <kbd className="border-border rounded border px-1">↓</kbd> to navigate,{' '}
                    <kbd className="border-border rounded border px-1">Enter</kbd> to select
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
