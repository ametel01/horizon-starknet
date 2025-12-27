'use client';

import { AlertTriangle, Info, ShieldAlert, TrendingDown } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import { cn } from '@shared/lib/utils';
import {
  formatPriceImpact,
  getPriceImpactSeverity,
  type PriceImpactSeverity,
} from '@shared/math/amm';
import { Button } from '@shared/ui/Button';

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

const SEVERITY_CONFIG: Record<Exclude<PriceImpactSeverity, 'low'>, SeverityConfig> = {
  medium: {
    icon: <Info className="h-5 w-5" />,
    title: 'Moderate Price Impact',
    description:
      'This trade has a moderate price impact. The larger your trade relative to liquidity, the more you pay above market price.',
    variant: 'warning',
  },
  high: {
    icon: <TrendingDown className="h-5 w-5" />,
    title: 'High Price Impact',
    description:
      'This trade has significant price impact. Consider splitting into smaller trades or waiting for more liquidity.',
    variant: 'warning',
  },
  'very-high': {
    icon: <AlertTriangle className="h-5 w-5" />,
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
  const [mounted, setMounted] = useState(false);
  const severity = getPriceImpactSeverity(priceImpact);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, []);

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
    <div
      className={cn(
        'overflow-hidden rounded-xl border p-4 transition-all duration-500',
        isDestructive
          ? 'border-destructive/30 bg-destructive/10'
          : 'border-warning/30 bg-warning/10',
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 shrink-0 rounded-lg p-1.5',
            isDestructive ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'
          )}
        >
          {config.icon}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <span
              className={cn('font-medium', isDestructive ? 'text-destructive' : 'text-warning')}
            >
              {config.title}
            </span>
            <span
              className={cn(
                'font-mono text-sm font-semibold',
                isDestructive ? 'text-destructive' : 'text-warning'
              )}
            >
              {formatPriceImpact(priceImpact)}
            </span>
          </div>
          <p className={cn('text-sm', isDestructive ? 'text-destructive/80' : 'text-warning/80')}>
            {config.description}
          </p>

          {requiresAcknowledgment && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcknowledge}
                className="border-destructive/30 text-destructive hover:bg-destructive/20 w-full gap-2"
              >
                <ShieldAlert className="h-4 w-4" />I understand the risks, proceed anyway
              </Button>
            </div>
          )}

          {severity === 'very-high' && isAcknowledged && (
            <p className="text-destructive/80 flex items-center gap-1.5 text-xs">
              <ShieldAlert className="h-3.5 w-3.5" />
              Warning acknowledged. You may proceed with the swap.
            </p>
          )}
        </div>
      </div>
    </div>
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
