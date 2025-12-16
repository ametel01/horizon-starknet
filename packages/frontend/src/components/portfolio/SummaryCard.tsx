'use client';

import { type ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  label: string;
  value: string;
  subValue?: string;
  variant?: 'default' | 'positive' | 'negative';
  action?: ReactNode;
  className?: string;
}

export function SummaryCard({
  label,
  value,
  subValue,
  variant = 'default',
  action,
  className,
}: SummaryCardProps): ReactNode {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="text-muted-foreground text-sm">{label}</div>
        <div
          className={cn(
            'mt-1 text-2xl font-semibold',
            variant === 'positive' && 'text-primary',
            variant === 'negative' && 'text-destructive',
            variant === 'default' && 'text-foreground'
          )}
        >
          {value}
        </div>
        {subValue && (
          <div
            className={cn(
              'text-sm',
              variant === 'positive' && 'text-primary/80',
              variant === 'negative' && 'text-destructive/80',
              variant === 'default' && 'text-muted-foreground'
            )}
          >
            {subValue}
          </div>
        )}
        {action !== undefined && <div className="mt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}
