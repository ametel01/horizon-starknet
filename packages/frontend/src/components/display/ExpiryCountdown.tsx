import { type ReactNode } from 'react';

import { formatExpiry, formatTimeToExpiry, isExpired } from '@/lib/math/yield';
import { cn } from '@/lib/utils';

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
      <span className={cn('font-medium', expired ? 'text-red-500' : 'text-neutral-100')}>
        {timeRemaining}
      </span>
      {showDate && !expired && <span className="ml-2 text-neutral-500">({expiryDate})</span>}
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
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        expired ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500',
        className
      )}
    >
      {timeRemaining}
    </span>
  );
}
