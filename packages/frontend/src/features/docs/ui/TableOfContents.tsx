'use client';

import { cn } from '@shared/lib/utils';
import { useEffect, useState, useSyncExternalStore } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

const EMPTY_HEADINGS: TocItem[] = [];
let headingsSnapshot: TocItem[] = EMPTY_HEADINGS;
let headingsSnapshotKey = '';

function cacheHeadings(items: TocItem[]): TocItem[] {
  const snapshotKey = items.map((item) => `${item.level}:${item.id}:${item.text}`).join('|');
  if (snapshotKey === headingsSnapshotKey) {
    return headingsSnapshot;
  }

  headingsSnapshotKey = snapshotKey;
  headingsSnapshot = items.length > 0 ? items : EMPTY_HEADINGS;
  return headingsSnapshot;
}

function readHeadingsFromDocument(): TocItem[] {
  if (typeof document === 'undefined') {
    return EMPTY_HEADINGS;
  }

  // Get only h2 headings from the main prose content (skip component headings)
  const article = document.querySelector('article');
  if (!article) {
    return cacheHeadings([]);
  }

  // Only select direct h2 children or h2s within prose sections
  const elements = article.querySelectorAll<HTMLElement>(
    ':scope > h2, .prose > h2, :scope > * > h2'
  );
  const items: TocItem[] = [];

  elements.forEach((element) => {
    // Skip headings inside not-prose sections (interactive components)
    if (element.closest('.not-prose')) return;

    const textContent = element.textContent;
    if (!textContent) return;

    const id = element.id !== '' ? element.id : textContent.toLowerCase().replace(/\s+/g, '-');
    if (!element.id) {
      element.id = id;
    }
    items.push({
      id,
      text: textContent,
      level: 2,
    });
  });

  return cacheHeadings(items);
}

function getHeadingsSnapshot(): TocItem[] {
  return headingsSnapshot;
}

function getHeadingsServerSnapshot(): TocItem[] {
  return EMPTY_HEADINGS;
}

function subscribeToHeadings(callback: () => void): () => void {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  let refreshTimer: number | null = null;
  const refresh = (): void => {
    refreshTimer = null;
    readHeadingsFromDocument();
    callback();
  };
  const scheduleRefresh = (): void => {
    if (refreshTimer !== null) return;
    refreshTimer = window.setTimeout(refresh, 0);
  };

  scheduleRefresh();

  const article = document.querySelector('article');
  if (!article || typeof MutationObserver === 'undefined') {
    return () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(article, {
    attributes: true,
    attributeFilter: ['id'],
    characterData: true,
    childList: true,
    subtree: true,
  });

  return () => {
    if (refreshTimer !== null) {
      window.clearTimeout(refreshTimer);
    }
    observer.disconnect();
  };
}

export function TableOfContents(): React.ReactNode {
  const headings = useSyncExternalStore(
    subscribeToHeadings,
    getHeadingsSnapshot,
    getHeadingsServerSnapshot
  );
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav>
      <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
        On this page
      </p>
      <ul className="border-border space-y-1 border-l text-sm">
        {headings.map((heading) => (
          <li key={heading.id}>
            <button
              type="button"
              className={cn(
                'text-muted-foreground hover:text-foreground -ml-px block w-full border-l py-1 pl-3 text-left transition-colors',
                activeId === heading.id ? 'border-primary text-foreground' : 'border-transparent'
              )}
              onClick={() => {
                const element = document.getElementById(heading.id);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                  setActiveId(heading.id);
                }
              }}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
