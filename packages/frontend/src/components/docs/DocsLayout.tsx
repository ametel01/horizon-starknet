'use client';

import { Menu, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

import { DocsSidebar } from './DocsSidebar';

interface DocsLayoutProps {
  children: React.ReactNode;
}

export function DocsLayout({ children }: DocsLayoutProps): React.ReactNode {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="flex gap-10 lg:gap-12">
        {/* Mobile sidebar toggle */}
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 z-50 shadow-lg lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r border-border bg-background p-6 pt-20 transition-transform lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:border-0 lg:bg-transparent lg:pt-8',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <DocsSidebar />
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1 py-8 lg:py-10">
          <article className="max-w-3xl">{children}</article>
        </main>
      </div>
    </div>
  );
}
