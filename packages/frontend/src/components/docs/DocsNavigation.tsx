'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { navigation, type NavItem } from './DocsSidebar';

// Flatten navigation to get ordered list of pages
function flattenNavigation(items: NavItem[]): { title: string; href: string }[] {
  const result: { title: string; href: string }[] = [];

  for (const item of items) {
    if (item.href) {
      result.push({ title: item.title, href: item.href });
    }
    if (item.children) {
      result.push(...flattenNavigation(item.children));
    }
  }

  return result;
}

export function DocsNavigation(): React.ReactNode {
  const pathname = usePathname();
  const flatNav = flattenNavigation(navigation);
  const currentIndex = flatNav.findIndex((item) => item.href === pathname);

  const prevPage = currentIndex > 0 ? flatNav[currentIndex - 1] : null;
  const nextPage = currentIndex < flatNav.length - 1 ? flatNav[currentIndex + 1] : null;

  if (!prevPage && !nextPage) {
    return null;
  }

  return (
    <nav className="mt-12 flex items-center justify-between border-t border-border pt-6">
      {prevPage ? (
        <Link
          href={prevPage.href}
          className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <div>
            <div className="text-xs text-muted-foreground">Previous</div>
            <div className="font-medium text-foreground">{prevPage.title}</div>
          </div>
        </Link>
      ) : (
        <div />
      )}

      {nextPage ? (
        <Link
          href={nextPage.href}
          className="group flex items-center gap-2 text-right text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <div>
            <div className="text-xs text-muted-foreground">Next</div>
            <div className="font-medium text-foreground">{nextPage.title}</div>
          </div>
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
