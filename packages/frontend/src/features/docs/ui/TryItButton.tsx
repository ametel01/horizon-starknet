'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@shared/lib/utils';

interface TryItButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'default' | 'outline';
  className?: string;
}

export function TryItButton({
  href,
  children,
  variant = 'default',
  className,
}: TryItButtonProps): React.ReactNode {
  const isExternal = href.startsWith('http');

  const baseStyles =
    'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors';

  const variantStyles = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-border hover:bg-accent hover:text-accent-foreground',
  };

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(baseStyles, variantStyles[variant], className)}
      >
        {children}
        <ArrowRight className="h-4 w-4" />
      </a>
    );
  }

  return (
    <Link href={href} className={cn(baseStyles, variantStyles[variant], className)}>
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
