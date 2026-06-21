import { cn } from '@shared/lib/utils';
import { formatTimeToExpiry, isExpired } from '@shared/math/yield';
import { Badge } from '@shared/ui/badge';
import type { ReactNode } from 'react';

interface ExpiryBadgeProps {
  expiryTimestamp: number;
  className?: string;
}

export function ExpiryBadge({ expiryTimestamp, className }: ExpiryBadgeProps): ReactNode {
  const expired = isExpired(expiryTimestamp);
  const timeRemaining = formatTimeToExpiry(expiryTimestamp);

  return (
    <Badge variant={expired ? 'destructive' : 'default'} className={cn(className)}>
      {timeRemaining}
    </Badge>
  );
}
