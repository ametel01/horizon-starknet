'use client';

import { Menu, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

import { DocsSearch } from './DocsSearch';
import { DocsSidebar } from './DocsSidebar';
import { TableOfContents } from './TableOfContents';

interface DocsLayoutProps {
  children: React.ReactNode;
}

export function DocsLayout({ children }: DocsLayoutProps): React.ReactNode {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="flex gap-8 lg:gap-10">
        {/* Mobile sidebar toggle */}
        <Button
          variant="outline"
          size="icon"
          className="fixed right-4 bottom-4 z-50 shadow-lg lg:hidden"
          onClick={() => {
            setSidebarOpen(!sidebarOpen);
          }}
          aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {/* Left Sidebar - Navigation */}
        <aside
          className={cn(
            'border-border bg-background fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r p-6 pt-20 transition-transform lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:border-0 lg:bg-transparent lg:pt-8',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="mb-4">
            <DocsSearch />
          </div>
          <DocsSidebar />
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="bg-background/80 fixed inset-0 z-30 backdrop-blur-sm lg:hidden"
            onClick={() => {
              setSidebarOpen(false);
            }}
          />
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1 py-6 lg:py-10">
          {/* Mobile search */}
          <div className="mb-6 lg:hidden">
            <DocsSearch />
          </div>
          <article className="prose prose-neutral dark:prose-invert prose-headings:scroll-mt-20 max-w-3xl">
            {children}
          </article>
        </main>

        {/* Right Sidebar - Table of Contents */}
        <aside className="hidden w-48 shrink-0 xl:block">
          <div className="sticky top-24 py-8">
            <TableOfContents />
          </div>
        </aside>
      </div>
    </div>
  );
}
