'use client';

import { useSyncExternalStore } from 'react';

type DateTextFormat = 'activity-date' | 'swap-timestamp';

const DATE_FORMAT_OPTIONS: Record<DateTextFormat, Intl.DateTimeFormatOptions> = {
  'activity-date': {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  },
  'swap-timestamp': {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
};

const unsubscribeFromHydration = (): void => undefined;
const subscribeToHydration = (): (() => void) => unsubscribeFromHydration;
const getClientSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
}

interface ClientDateTextProps {
  value: string | number | Date;
  format?: DateTextFormat;
  placeholder?: string;
}

export function ClientDateText({
  value,
  format = 'activity-date',
  placeholder = '-',
}: ClientDateTextProps): string {
  const isHydrated = useIsHydrated();

  if (!isHydrated) return placeholder;

  const date = new Date(value);
  const options = DATE_FORMAT_OPTIONS[format];
  return format === 'activity-date'
    ? date.toLocaleDateString(undefined, options)
    : date.toLocaleString(undefined, options);
}

interface ClientDaysUntilExpiryProps {
  expiry: number;
  placeholder?: string;
}

export function ClientDaysUntilExpiry({
  expiry,
  placeholder = '-',
}: ClientDaysUntilExpiryProps): string {
  const isHydrated = useIsHydrated();

  if (!isHydrated) return placeholder;

  const days = Math.round((expiry - Date.now() / 1000) / 86400);
  return `${String(days)}d left`;
}
