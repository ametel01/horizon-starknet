import { type ReactNode } from 'react';

import { cn } from '@shared/lib/utils';
import { formatExpiry, formatTimeToExpiry, isExpired } from '@shared/math/yield';
import { Badge } from '@shared/ui/badge';

interface ExpiryCountdownProps {
  expiryTimestamp: number;
  className?: string;
  showDate?: boolean;
}

export function ExpiryCountdown({
  expiryTimestamp,
  className,
  showDate = true,
}: ExpiryCountdownProps): ReactNode {
  const expired = isExpired(expiryTimestamp);
  const timeRemaining = formatTimeToExpiry(expiryTimestamp);
  const expiryDate = formatExpiry(expiryTimestamp);

  return (
    <div className={cn('text-sm', className)}>
      <span className={cn('font-medium', expired ? 'text-destructive' : 'text-foreground')}>
        {timeRemaining}
      </span>
      {showDate && !expired && <span className="text-muted-foreground ml-2">({expiryDate})</span>}
    </div>
  );
}

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
