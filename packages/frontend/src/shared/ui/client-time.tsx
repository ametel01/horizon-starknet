'use client';

import { useEffect, useState } from 'react';

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
  const [label, setLabel] = useState('');

  useEffect(() => {
    const date = new Date(value);
    const options = DATE_FORMAT_OPTIONS[format];
    const nextLabel =
      format === 'activity-date'
        ? date.toLocaleDateString(undefined, options)
        : date.toLocaleString(undefined, options);
    setLabel(nextLabel);
  }, [value, format]);

  return label || placeholder;
}

interface ClientDaysUntilExpiryProps {
  expiry: number;
  placeholder?: string;
}

export function ClientDaysUntilExpiry({
  expiry,
  placeholder = '-',
}: ClientDaysUntilExpiryProps): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const days = Math.round((expiry - Date.now() / 1000) / 86400);
    setLabel(`${String(days)}d left`);
  }, [expiry]);

  return label || placeholder;
}
