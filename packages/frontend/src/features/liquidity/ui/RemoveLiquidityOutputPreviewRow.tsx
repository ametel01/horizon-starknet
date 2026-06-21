import { formatWad } from '@shared/math/wad';
import type { ReactNode } from 'react';

interface OutputPreviewRowProps {
  label: string;
  value: bigint;
  minValue: bigint;
  isValid: boolean;
}

export function OutputPreviewRow({
  label,
  value,
  minValue,
  isValid,
}: OutputPreviewRowProps): ReactNode {
  const valueClass = isValid
    ? 'text-foreground text-lg font-semibold'
    : 'text-muted-foreground text-lg font-semibold';

  return (
    <div className="flex items-center justify-between">
      <span className={valueClass}>
        {isValid ? formatWad(value, 6) : '0.000000'} {label}
      </span>
      <span className="text-muted-foreground text-sm">
        min: {isValid ? formatWad(minValue, 6) : '-'}
      </span>
    </div>
  );
}
