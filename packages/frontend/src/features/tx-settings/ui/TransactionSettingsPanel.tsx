'use client';

import { type ReactNode, useState } from 'react';

import {
  DEADLINE_OPTIONS,
  DEFAULT_DEADLINE_MINUTES,
  DEFAULT_SLIPPAGE_BPS,
  MAX_DEADLINE_MINUTES,
  MAX_SLIPPAGE_BPS,
  MIN_DEADLINE_MINUTES,
  MIN_SLIPPAGE_BPS,
  SLIPPAGE_OPTIONS,
  useTransactionSettings,
} from '@features/tx-settings';
import { useUIMode } from '@shared/theme/ui-mode-context';
import { Button } from '@shared/ui/Button';
import { Input } from '@shared/ui/Input';
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
}

export function TransactionSettingsPanel({
  showDeadline,
  compact = false,
}: TransactionSettingsPanelProps): ReactNode {
  const { isAdvanced } = useUIMode();
  const { slippageBps, deadlineMinutes, setSlippageBps, setDeadlineMinutes, resetToDefaults } =
    useTransactionSettings();

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

  // Handle custom slippage submit
  const handleCustomSlippageSubmit = (): void => {
    const value = parseFloat(customSlippage);
    if (!isNaN(value) && value >= MIN_SLIPPAGE_BPS / 100 && value <= MAX_SLIPPAGE_BPS / 100) {
      setSlippageBps(Math.round(value * 100));
      setShowCustomSlippage(false);
      setCustomSlippage('');
    }
  };

  // Handle custom deadline submit
  const handleCustomDeadlineSubmit = (): void => {
    const value = parseInt(customDeadline, 10);
    if (!isNaN(value) && value >= MIN_DEADLINE_MINUTES && value <= MAX_DEADLINE_MINUTES) {
      setDeadlineMinutes(value);
      setShowCustomDeadline(false);
      setCustomDeadline('');
    }
  };

  // Check if modified from defaults
  const isModified =
    slippageBps !== DEFAULT_SLIPPAGE_BPS || deadlineMinutes !== DEFAULT_DEADLINE_MINUTES;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Slippage: {(slippageBps / 100).toFixed(1)}%</span>
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
          {!isSlippagePreset && (
            <span className="text-primary text-xs">Custom: {(slippageBps / 100).toFixed(2)}%</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ToggleGroup className="flex gap-1">
            {SLIPPAGE_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                pressed={slippageBps === option.value && !showCustomSlippage}
                onPressedChange={() => {
                  setSlippageBps(option.value);
                  setShowCustomSlippage(false);
                }}
                variant="outline"
                size="sm"
              >
                {option.label}
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
                className="h-8 w-20"
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
                    setDeadlineMinutes(option.value);
                    setShowCustomDeadline(false);
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
  const { slippagePercent, deadlineMinutes } = useTransactionSettings();

  return (
    <div className="text-muted-foreground flex items-center gap-3 text-sm">
      <span>Slippage: {slippagePercent}</span>
      {isAdvanced && <span>Deadline: {deadlineMinutes}m</span>}
    </div>
  );
}
