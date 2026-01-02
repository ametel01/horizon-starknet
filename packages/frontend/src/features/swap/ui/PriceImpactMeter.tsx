'use client';

import { cn } from '@shared/lib/utils';
import {
  formatPriceImpact,
  getPriceImpactSeverity,
  type PriceImpactSeverity,
} from '@shared/math/amm';
import { Activity, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

interface PriceImpactMeterProps {
  impact: number;
  className?: string | undefined;
  /** Show compact version without gauge (default: false) */
  compact?: boolean;
  /** Show animated entrance (default: true) */
  animated?: boolean;
}

/**
 * Get severity configuration for styling
 */
function getSeverityConfig(severity: PriceImpactSeverity): {
  icon: ReactNode;
  label: string;
  color: string;
  bgColor: string;
  strokeColor: string;
} {
  switch (severity) {
    case 'low':
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        label: 'Minimal',
        color: 'text-primary',
        bgColor: 'bg-primary/10',
        strokeColor: 'var(--primary)',
      };
    case 'medium':
      return {
        icon: <Activity className="h-4 w-4" />,
        label: 'Moderate',
        color: 'text-warning',
        bgColor: 'bg-warning/10',
        strokeColor: 'var(--warning)',
      };
    case 'high':
      return {
        icon: <TrendingDown className="h-4 w-4" />,
        label: 'High',
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
        strokeColor: 'var(--destructive)',
      };
    case 'very-high':
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        label: 'Very High',
        color: 'text-destructive',
        bgColor: 'bg-destructive/20',
        strokeColor: 'var(--destructive)',
      };
  }
}

/**
 * Arc gauge component for visual impact display
 * Uses stroke-dashoffset for smooth CSS transitions
 */
function ArcGauge({
  value,
  severity,
  animated,
}: {
  value: number;
  severity: PriceImpactSeverity;
  animated: boolean;
}): ReactNode {
  const [displayValue, setDisplayValue] = useState(animated ? 0 : value);

  useEffect(() => {
    if (animated) {
      // Small delay to trigger the CSS transition
      const timer = setTimeout(() => {
        setDisplayValue(value);
      }, 50);
      return () => {
        clearTimeout(timer);
      };
    }
    setDisplayValue(value);
    return undefined;
  }, [value, animated]);

  const config = getSeverityConfig(severity);

  // Arc parameters
  const radius = 40;
  const strokeWidth = 6;
  const cx = 50;
  const cy = 50;

  // Arc spans 180 degrees (semicircle) - circumference of half circle
  const arcLength = Math.PI * radius;

  // Calculate how much of the arc to show (0-100% maps to full arc)
  const filledLength = (displayValue / 100) * arcLength;
  const dashOffset = arcLength - filledLength;

  // Arc path: semicircle from left to right
  const arcPath = `M ${String(cx - radius)} ${String(cy)} A ${String(radius)} ${String(radius)} 0 0 1 ${String(cx + radius)} ${String(cy)}`;

  // Tick mark positions
  const ticks = [0, 25, 50, 75, 100];

  return (
    <svg viewBox="0 0 100 55" className="h-16 w-full">
      {/* Background arc */}
      <path
        d={arcPath}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Filled arc - uses stroke-dashoffset for smooth animation */}
      <path
        d={arcPath}
        fill="none"
        stroke={config.strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={arcLength}
        strokeDashoffset={dashOffset}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
      {/* Severity tick marks */}
      {ticks.map((tick) => {
        // Angle: 0% = PI (left), 100% = 0 (right)
        const tickAngle = Math.PI - (tick / 100) * Math.PI;
        const innerRadius = radius - strokeWidth / 2 - 3;
        const outerRadius = radius - strokeWidth / 2 - 1;
        const x1 = cx + innerRadius * Math.cos(tickAngle);
        const y1 = cy - innerRadius * Math.sin(tickAngle);
        const x2 = cx + outerRadius * Math.cos(tickAngle);
        const y2 = cy - outerRadius * Math.sin(tickAngle);
        return (
          <line
            key={tick}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            opacity={0.5}
          />
        );
      })}
    </svg>
  );
}

/**
 * Visual price impact meter with color-coded severity and arc gauge
 *
 * Shows an arc gauge that fills based on price impact percentage.
 * Colors change based on severity: green → yellow → red
 */
export function PriceImpactMeter({
  impact,
  className,
  compact = false,
  animated = true,
}: PriceImpactMeterProps): ReactNode {
  const [mounted, setMounted] = useState(!animated);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setMounted(true);
      }, 50);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [animated]);

  const severity = getPriceImpactSeverity(impact);
  const config = useMemo(() => getSeverityConfig(severity), [severity]);

  // Scale: 0-10% impact = 0-100% gauge fill
  const gaugeValue = Math.min(Math.abs(impact) * 1000, 100);

  // Compact version (simple progress bar)
  if (compact) {
    return (
      <div className={cn('space-y-1.5', className)}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className={config.color}>{config.icon}</span>
            Price Impact
          </span>
          <span className={cn('font-mono font-medium', config.color)}>
            {formatPriceImpact(impact)}
          </span>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              severity === 'low' && 'bg-primary',
              severity === 'medium' && 'bg-warning',
              (severity === 'high' || severity === 'very-high') && 'bg-destructive'
            )}
            style={{ width: `${String(mounted ? gaugeValue : 0)}%` }}
          />
        </div>
      </div>
    );
  }

  // Full version with arc gauge
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all duration-500',
        config.bgColor,
        severity === 'very-high' ? 'border-destructive/30' : 'border-border/50',
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        className
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <span className="text-muted-foreground text-xs font-medium">Price Impact</span>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            config.bgColor,
            config.color
          )}
        >
          {config.label}
        </span>
      </div>

      {/* Arc gauge */}
      <ArcGauge value={gaugeValue} severity={severity} animated={animated} />

      {/* Value display */}
      <div className="text-center">
        <span className={cn('font-mono text-2xl font-bold', config.color)}>
          {formatPriceImpact(impact)}
        </span>
        {severity === 'very-high' && (
          <p className="text-destructive/80 mt-1 text-xs">
            Trade size is large relative to liquidity
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Inline price impact indicator for compact displays
 */
export function PriceImpactIndicator({
  impact,
  className,
}: {
  impact: number;
  className?: string;
}): ReactNode {
  const severity = getPriceImpactSeverity(impact);
  const config = getSeverityConfig(severity);

  return (
    <span className={cn('inline-flex items-center gap-1', config.color, className)}>
      {config.icon}
      <span className="font-mono text-sm font-medium">{formatPriceImpact(impact)}</span>
    </span>
  );
}
