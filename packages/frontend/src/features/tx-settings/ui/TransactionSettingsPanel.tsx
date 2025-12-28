'use client';

import { Sparkles } from 'lucide-react';
import { type ReactNode, useCallback, useState } from 'react';
import { toast } from 'sonner';

import {
  DEADLINE_OPTIONS,
  DEFAULT_DEADLINE_MINUTES,
  DEFAULT_SLIPPAGE_BPS,
  formatSlippagePercent,
  getSlippageLabel,
  MAX_DEADLINE_MINUTES,
  MAX_SLIPPAGE_BPS,
  MIN_DEADLINE_MINUTES,
  MIN_SLIPPAGE_BPS,
  SLIPPAGE_OPTIONS,
  useSmartSlippage,
  useTransactionSettings,
} from '@features/tx-settings';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { Button } from '@shared/ui/Button';
import { Input } from '@shared/ui/Input';
import { Skeleton } from '@shared/ui/Skeleton';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';

/**
 * Transaction Settings Panel
 *
 * Displays slippage and deadline settings with preset options
 * and custom input. Shows deadline settings only in advanced mode.
 *
 * @see Security Audit M-06 - Router Deadline Protection
 */

interface TransactionSettingsPanelProps {
  /** Whether to show deadline settings (hidden in simple mode by default) */
  showDeadline?: boolean;
  /** Show as compact inline version */
  compact?: boolean;
  /** Market address for smart slippage calculation (Error Prevention) */
  marketAddress?: string | undefined;
}

export function TransactionSettingsPanel({
  showDeadline,
  compact = false,
  marketAddress,
}: TransactionSettingsPanelProps): ReactNode {
  const { isAdvanced } = useUIMode();
  const { slippageBps, deadlineMinutes, setSlippageBps, setDeadlineMinutes, resetToDefaults } =
    useTransactionSettings();

  // Smart slippage calculation based on market volatility (Error Prevention)
  const smartSlippage = useSmartSlippage(marketAddress);

  // Local state for custom inputs
  const [customSlippage, setCustomSlippage] = useState<string>('');
  const [customDeadline, setCustomDeadline] = useState<string>('');
  const [showCustomSlippage, setShowCustomSlippage] = useState(false);
  const [showCustomDeadline, setShowCustomDeadline] = useState(false);

  // Determine if deadline should be shown
  const shouldShowDeadline = showDeadline ?? isAdvanced;

  // Check if current value matches a preset
  const isSlippagePreset = SLIPPAGE_OPTIONS.some((opt) => opt.value === slippageBps);
  const isDeadlinePreset = DEADLINE_OPTIONS.some((opt) => opt.value === deadlineMinutes);

  // Handle custom slippage submit with confirmation feedback
  const handleCustomSlippageSubmit = (): void => {
    const value = parseFloat(customSlippage);
    if (!isNaN(value) && value >= MIN_SLIPPAGE_BPS / 100 && value <= MAX_SLIPPAGE_BPS / 100) {
      const bps = Math.round(value * 100);
      setSlippageBps(bps);
      setShowCustomSlippage(false);
      setCustomSlippage('');
      toast.success(`Custom slippage set to ${String(value)}%`, {
        description: `Transactions will fail if price moves more than ${String(value)}%`,
        duration: 2000,
      });
    }
  };

  // Handle custom deadline submit with confirmation feedback
  const handleCustomDeadlineSubmit = (): void => {
    const value = parseInt(customDeadline, 10);
    if (!isNaN(value) && value >= MIN_DEADLINE_MINUTES && value <= MAX_DEADLINE_MINUTES) {
      setDeadlineMinutes(value);
      setShowCustomDeadline(false);
      setCustomDeadline('');
      toast.success(`Deadline set to ${String(value)} minutes`, {
        description: `Transactions will expire if not confirmed within ${String(value)} min`,
        duration: 2000,
      });
    }
  };

  // Check if modified from defaults
  const isModified =
    slippageBps !== DEFAULT_SLIPPAGE_BPS || deadlineMinutes !== DEFAULT_DEADLINE_MINUTES;

  // Handle slippage preset change with confirmation feedback
  const handleSlippagePresetChange = useCallback(
    (value: number, label: string): void => {
      setSlippageBps(value);
      setShowCustomSlippage(false);
      toast.success(`Slippage set to ${label}`, {
        description: `Transactions will fail if price moves more than ${(value / 100).toFixed(1)}%`,
        duration: 2000,
      });
    },
    [setSlippageBps]
  );

  // Handle deadline preset change with confirmation feedback
  const handleDeadlinePresetChange = useCallback(
    (value: number): void => {
      setDeadlineMinutes(value);
      setShowCustomDeadline(false);
      toast.success(`Deadline set to ${String(value)} minutes`, {
        description: `Transactions will expire if not confirmed within ${String(value)} min`,
        duration: 2000,
      });
    },
    [setDeadlineMinutes]
  );

  // Handle applying smart slippage recommendation
  const handleApplySmartSlippage = useCallback((): void => {
    if (!smartSlippage.factors.hasMarketData) return;

    const bps = smartSlippage.recommendedBps;
    setSlippageBps(bps);
    setShowCustomSlippage(false);
    toast.success(`Smart slippage: ${formatSlippagePercent(bps)}`, {
      description: smartSlippage.reason,
      duration: 3000,
    });
  }, [smartSlippage, setSlippageBps]);

  // Check if current slippage matches smart recommendation (within 5 BPS tolerance)
  const isUsingSmartSlippage =
    smartSlippage.factors.hasMarketData &&
    Math.abs(slippageBps - smartSlippage.recommendedBps) <= 5;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          Slippage: {(slippageBps / 100).toFixed(1)}%{' '}
          <span className="text-xs opacity-70">({getSlippageLabel(slippageBps)})</span>
        </span>
        {shouldShowDeadline && (
          <span className="text-muted-foreground">Deadline: {deadlineMinutes}m</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Slippage Settings */}
      <div>
        <div className="text-muted-foreground mb-2 flex items-center justify-between text-sm">
          <span>Slippage Tolerance</span>
          {isUsingSmartSlippage ? (
            <span className="text-success flex items-center gap-1 text-xs">
              <Sparkles className="size-3" />
              Auto: {formatSlippagePercent(slippageBps)}
            </span>
          ) : !isSlippagePreset ? (
            <span className="text-primary text-xs">
              Custom: {(slippageBps / 100).toFixed(2)}%{' '}
              <span className="text-muted-foreground">({getSlippageLabel(slippageBps)})</span>
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {/* Smart Slippage Button (when market data available) */}
            {marketAddress && (
              <ToggleGroupItem
                pressed={isUsingSmartSlippage}
                onPressedChange={handleApplySmartSlippage}
                disabled={smartSlippage.isLoading || !smartSlippage.factors.hasMarketData}
                variant="outline"
                size="sm"
                className="shrink-0"
                aria-label="Apply smart slippage based on market conditions"
              >
                {smartSlippage.isLoading ? (
                  <Skeleton className="h-4 w-8" />
                ) : (
                  <span className="flex items-center gap-1">
                    <Sparkles className="size-3" />
                    <span className="font-medium">Auto</span>
                  </span>
                )}
              </ToggleGroupItem>
            )}

            <ToggleGroup className="flex flex-1 gap-1">
              {SLIPPAGE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  pressed={
                    slippageBps === option.value && !showCustomSlippage && !isUsingSmartSlippage
                  }
                  onPressedChange={() => {
                    handleSlippagePresetChange(option.value, option.label);
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  aria-label={`${option.label} slippage: ${option.percent}`}
                >
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-muted-foreground text-[10px]">{option.percent}</span>
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {showCustomSlippage ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={MIN_SLIPPAGE_BPS / 100}
                  max={MAX_SLIPPAGE_BPS / 100}
                  step={0.1}
                  value={customSlippage}
                  onChange={(e) => {
                    setCustomSlippage(e.target.value);
                  }}
                  placeholder="0.5"
                  className="h-8 w-16"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCustomSlippageSubmit();
                    if (e.key === 'Escape') setShowCustomSlippage(false);
                  }}
                  autoFocus
                />
                <span className="text-muted-foreground text-sm">%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCustomSlippageSubmit}
                  className="h-8 px-2"
                >
                  Set
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCustomSlippage(true);
                }}
                className="text-muted-foreground h-8 px-2 text-xs"
              >
                Custom
              </Button>
            )}
          </div>

          {/* Show description for smart slippage or selected preset */}
          {isUsingSmartSlippage ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span
                className={
                  smartSlippage.confidence === 'high'
                    ? 'text-success'
                    : smartSlippage.confidence === 'medium'
                      ? 'text-warning'
                      : 'text-muted-foreground'
                }
              >
                {smartSlippage.confidence === 'high'
                  ? '●'
                  : smartSlippage.confidence === 'medium'
                    ? '◐'
                    : '○'}
              </span>
              {smartSlippage.reason}
            </p>
          ) : isSlippagePreset && !showCustomSlippage ? (
            <p className="text-muted-foreground text-xs">
              {SLIPPAGE_OPTIONS.find((opt) => opt.value === slippageBps)?.description}
            </p>
          ) : null}
        </div>

        {/* Slippage Warning */}
        {slippageBps > 200 && (
          <p className="text-chart-1 mt-1 text-xs">
            High slippage increases risk of unfavorable trades
          </p>
        )}
        {slippageBps < 10 && (
          <p className="text-chart-1 mt-1 text-xs">Low slippage may cause transaction failures</p>
        )}
      </div>

      {/* Deadline Settings (Advanced mode only by default) */}
      {shouldShowDeadline && (
        <div>
          <div className="text-muted-foreground mb-2 flex items-center justify-between text-sm">
            <span>Transaction Deadline</span>
            {!isDeadlinePreset && (
              <span className="text-primary text-xs">Custom: {deadlineMinutes} min</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ToggleGroup className="flex gap-1">
              {DEADLINE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  pressed={deadlineMinutes === option.value && !showCustomDeadline}
                  onPressedChange={() => {
                    handleDeadlinePresetChange(option.value);
                  }}
                  variant="outline"
                  size="sm"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {showCustomDeadline ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={MIN_DEADLINE_MINUTES}
                  max={MAX_DEADLINE_MINUTES}
                  step={1}
                  value={customDeadline}
                  onChange={(e) => {
                    setCustomDeadline(e.target.value);
                  }}
                  placeholder="20"
                  className="h-8 w-16"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCustomDeadlineSubmit();
                    if (e.key === 'Escape') setShowCustomDeadline(false);
                  }}
                  autoFocus
                />
                <span className="text-muted-foreground text-sm">min</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCustomDeadlineSubmit}
                  className="h-8 px-2"
                >
                  Set
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCustomDeadline(true);
                }}
                className="text-muted-foreground h-8 px-2 text-xs"
              >
                Custom
              </Button>
            )}
          </div>

          {/* Deadline Info */}
          <p className="text-muted-foreground mt-1 text-xs">
            Transaction will revert if not confirmed within {deadlineMinutes} minutes
          </p>
        </div>
      )}

      {/* Reset Button */}
      {isModified && (
        <Button variant="ghost" size="sm" onClick={resetToDefaults} className="text-xs">
          Reset to defaults
        </Button>
      )}
    </div>
  );
}

/**
 * Compact inline display of current transaction settings
 */
export function TransactionSettingsDisplay(): ReactNode {
  const { isAdvanced } = useUIMode();
  const { slippageBps, slippagePercent, deadlineMinutes } = useTransactionSettings();

  return (
    <div className="text-muted-foreground flex items-center gap-3 text-sm">
      <span>
        Slippage: {slippagePercent}{' '}
        <span className="text-xs opacity-70">({getSlippageLabel(slippageBps)})</span>
      </span>
      {isAdvanced && <span>Deadline: {deadlineMinutes}m</span>}
    </div>
  );
}
