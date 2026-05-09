'use client';

import { cn } from '@shared/lib/utils';
import { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents(): React.ReactNode {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    // Get only h2 headings from the main prose content (skip component headings)
    const article = document.querySelector('article');
    if (!article) return;

    // Only select direct h2 children or h2s within prose sections
    const elements = article.querySelectorAll(':scope > h2, .prose > h2, :scope > * > h2');
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

    setHeadings(items);
  }, []);

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
