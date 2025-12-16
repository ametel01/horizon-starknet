'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  formatPriceImpact,
  getPriceImpactSeverity,
  type PriceImpactSeverity,
} from '@/lib/math/amm';
import { cn } from '@/lib/utils';

interface PriceImpactWarningProps {
  priceImpact: number;
  onAcknowledge?: () => void;
  acknowledged?: boolean;
  className?: string;
}

interface SeverityConfig {
  icon: ReactNode;
  title: string;
  description: string;
  variant: 'warning' | 'destructive';
}

const WarningIcon = ({ className }: { className?: string }): ReactNode => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }): ReactNode => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const SEVERITY_CONFIG: Record<Exclude<PriceImpactSeverity, 'low'>, SeverityConfig> = {
  medium: {
    icon: <AlertIcon className="h-5 w-5" />,
    title: 'Moderate Price Impact',
    description:
      'This trade has a moderate price impact. The larger your trade relative to liquidity, the more you pay above market price.',
    variant: 'warning',
  },
  high: {
    icon: <WarningIcon className="h-5 w-5" />,
    title: 'High Price Impact',
    description:
      'This trade has significant price impact. Consider splitting into smaller trades or waiting for more liquidity.',
    variant: 'warning',
  },
  'very-high': {
    icon: <WarningIcon className="h-5 w-5" />,
    title: 'Very High Price Impact',
    description:
      'This trade has extremely high price impact. You will receive significantly less than the market rate. Only proceed if you understand the risks.',
    variant: 'destructive',
  },
};

export function PriceImpactWarning({
  priceImpact,
  onAcknowledge,
  acknowledged = false,
  className,
}: PriceImpactWarningProps): ReactNode {
  const [localAcknowledged, setLocalAcknowledged] = useState(false);
  const severity = getPriceImpactSeverity(priceImpact);

  if (severity === 'low') {
    return null;
  }

  const config = SEVERITY_CONFIG[severity];
  const isAcknowledged = acknowledged || localAcknowledged;
  const requiresAcknowledgment = severity === 'very-high' && !isAcknowledged;
  const isDestructive = config.variant === 'destructive';

  const handleAcknowledge = (): void => {
    setLocalAcknowledged(true);
    onAcknowledge?.();
  };

  return (
    <Card
      size="sm"
      className={cn(
        'border',
        isDestructive
          ? 'border-destructive/30 bg-destructive/10'
          : 'border-chart-1/30 bg-chart-1/10',
        className
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div
            className={cn('mt-0.5 shrink-0', isDestructive ? 'text-destructive' : 'text-chart-1')}
          >
            {config.icon}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span
                className={cn('font-medium', isDestructive ? 'text-destructive' : 'text-chart-1')}
              >
                {config.title}
              </span>
              <span
                className={cn(
                  'font-mono text-sm font-semibold',
                  isDestructive ? 'text-destructive' : 'text-chart-1'
                )}
              >
                {formatPriceImpact(priceImpact)}
              </span>
            </div>
            <p className={cn('text-sm', isDestructive ? 'text-destructive/80' : 'text-chart-1/80')}>
              {config.description}
            </p>

            {requiresAcknowledgment && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcknowledge}
                  className="border-destructive/30 text-destructive hover:bg-destructive/20 w-full"
                >
                  I understand the risks, proceed anyway
                </Button>
              </div>
            )}

            {severity === 'very-high' && isAcknowledged && (
              <p className="text-destructive/80 text-xs">
                Warning acknowledged. You may proceed with the swap.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function usePriceImpactWarning(priceImpact: number): {
  severity: PriceImpactSeverity;
  requiresAcknowledgment: boolean;
  acknowledged: boolean;
  acknowledge: () => void;
  reset: () => void;
  canProceed: boolean;
} {
  const [acknowledged, setAcknowledged] = useState(false);
  const severity = getPriceImpactSeverity(priceImpact);
  const requiresAcknowledgment = severity === 'very-high';

  // Reset acknowledgment when price impact increases to very-high
  useEffect(() => {
    if (severity === 'very-high') {
      setAcknowledged(false);
    }
  }, [priceImpact, severity]);

  return {
    severity,
    requiresAcknowledgment,
    acknowledged,
    acknowledge: () => {
      setAcknowledged(true);
    },
    reset: () => {
      setAcknowledged(false);
    },
    canProceed: !requiresAcknowledgment || acknowledged,
  };
}
