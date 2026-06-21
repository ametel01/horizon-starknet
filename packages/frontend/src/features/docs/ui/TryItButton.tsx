'use client';

import { cn } from '@shared/lib/utils';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface TryItButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'default' | 'outline';
  className?: string;
}

const BASE_STYLES =
  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors';

const VARIANT_STYLES = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  outline: 'border border-border hover:bg-accent hover:text-accent-foreground',
};

export function TryItButton({
  href,
  children,
  variant = 'default',
  className,
}: TryItButtonProps): React.ReactNode {
  const isExternal = href.startsWith('http');

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(BASE_STYLES, VARIANT_STYLES[variant], className)}
      >
        {children}
        <ArrowRight className="size-4" />
      </a>
    );
  }

  return (
    <Link href={href} className={cn(BASE_STYLES, VARIANT_STYLES[variant], className)}>
      {children}
      <ArrowRight className="size-4" />
    </Link>
  );
}
