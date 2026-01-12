import { createMemo, createSignal, type Accessor, type JSX, Show } from 'solid-js';
import { toast } from 'solid-sonner';

import { Button } from '@shared/ui/Button';
import { Input } from '@shared/ui/Input';
import { Skeleton } from '@shared/ui/Skeleton';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/ToggleGroup';

import {
  DEFAULT_DEADLINE_MINUTES,
  DEFAULT_SLIPPAGE_BPS,
  DEADLINE_OPTIONS,
  formatSlippagePercent,
  getSlippageLabel,
  MAX_DEADLINE_MINUTES,
  MAX_SLIPPAGE_BPS,
  MIN_DEADLINE_MINUTES,
  MIN_SLIPPAGE_BPS,
  SLIPPAGE_OPTIONS,
  useTransactionSettings,
  useUIMode,
} from '@/providers';

// ============================================================================
// Inline Icons
// ============================================================================

function SparklesIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

// ============================================================================
// Types
// ============================================================================

/**
 * Decision table for confidence indicator display.
 * Maps confidence level to styling and symbol.
 */
type ConfidenceLevel = 'high' | 'medium' | 'low';

const CONFIDENCE_DISPLAY: Record<ConfidenceLevel, { className: string; symbol: string }> = {
  high: { className: 'text-success', symbol: '●' },
  medium: { className: 'text-warning', symbol: '◐' },
  low: { className: 'text-muted-foreground', symbol: '○' },
};

function getConfidenceDisplay(confidence: ConfidenceLevel): { className: string; symbol: string } {
  return CONFIDENCE_DISPLAY[confidence];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute slippage header status for display.
 * Separates render logic from computation.
 */
function computeSlippageStatus(
  isUsingSmartSlippage: boolean,
  isSlippagePreset: boolean,
  slippageBps: number
): { type: 'smart' | 'custom' | 'preset'; displayValue?: string } {
  if (isUsingSmartSlippage) return { type: 'smart' };
  if (!isSlippagePreset) return { type: 'custom', displayValue: (slippageBps / 100).toFixed(2) };
  return { type: 'preset' };
}

// ============================================================================
// Sub-Components
// ============================================================================

interface SlippageStatusBadgeProps {
  status: { type: 'smart' | 'custom' | 'preset'; displayValue?: string };
  slippageBps: number;
}

/**
 * Slippage status badge component - renders the appropriate badge based on status type
 */
function SlippageStatusBadge(props: SlippageStatusBadgeProps): JSX.Element {
  return (
    <>
      <Show when={props.status.type === 'smart'}>
        <span class="text-success flex items-center gap-1 text-xs">
          <SparklesIcon class="size-3" />
          Auto: {formatSlippagePercent(props.slippageBps)}
        </span>
      </Show>
      <Show when={props.status.type === 'custom'}>
        <span class="text-primary text-xs">
          Custom: {props.status.displayValue}%{' '}
          <span class="text-muted-foreground">({getSlippageLabel(props.slippageBps)})</span>
        </span>
      </Show>
    </>
  );
}

interface SlippageDescriptionProps {
  isUsingSmartSlippage: boolean;
  isSlippagePreset: boolean;
  showCustomSlippage: boolean;
  slippageBps: number;
  smartSlippage: {
    confidence: ConfidenceLevel;
    reason: string;
  };
}

/**
 * Slippage description shown below the slippage options.
 * Shows smart slippage reason or preset description.
 */
function SlippageDescription(props: SlippageDescriptionProps): JSX.Element {
  return (
    <>
      <Show when={props.isUsingSmartSlippage}>
        {(() => {
          const display = getConfidenceDisplay(props.smartSlippage.confidence);
          return (
            <p class="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span class={display.className}>{display.symbol}</span>
              {props.smartSlippage.reason}
            </p>
          );
        })()}
      </Show>
      <Show when={props.isSlippagePreset && !props.showCustomSlippage && !props.isUsingSmartSlippage}>
        {(() => {
          const option = SLIPPAGE_OPTIONS.find(
            (opt: (typeof SLIPPAGE_OPTIONS)[number]) => opt.value === props.slippageBps
          );
          return <p class="text-muted-foreground text-xs">{option?.description}</p>;
        })()}
      </Show>
    </>
  );
}

/**
 * Slippage warning messages for extreme values.
 */
function SlippageWarning(props: { slippageBps: number }): JSX.Element {
  return (
    <>
      <Show when={props.slippageBps > 200}>
        <p class="text-chart-1 mt-1 text-xs">
          High slippage increases risk of unfavorable trades
        </p>
      </Show>
      <Show when={props.slippageBps < 10}>
        <p class="text-chart-1 mt-1 text-xs">Low slippage may cause transaction failures</p>
      </Show>
    </>
  );
}

interface DeadlineSettingsProps {
  deadlineMinutes: number;
  isDeadlinePreset: boolean;
  showCustomDeadline: Accessor<boolean>;
  customDeadline: Accessor<string>;
  setCustomDeadline: (value: string) => void;
  setShowCustomDeadline: (value: boolean) => void;
  handleDeadlinePresetChange: (value: number) => void;
  handleCustomDeadlineSubmit: () => void;
}

/**
 * Deadline settings section - extracted to reduce main component complexity.
 */
function DeadlineSettings(props: DeadlineSettingsProps): JSX.Element {
  return (
    <div>
      <div class="text-muted-foreground mb-2 flex items-center justify-between text-sm">
        <span>Transaction Deadline</span>
        <Show when={!props.isDeadlinePreset}>
          <span class="text-primary text-xs">Custom: {props.deadlineMinutes} min</span>
        </Show>
      </div>

      <div class="flex items-center gap-2">
        <ToggleGroup class="flex gap-1">
          {DEADLINE_OPTIONS.map((option: (typeof DEADLINE_OPTIONS)[number]) => (
            <ToggleGroupItem
              pressed={props.deadlineMinutes === option.value && !props.showCustomDeadline()}
              onPressedChange={() => {
                props.handleDeadlinePresetChange(option.value);
              }}
              variant="outline"
              size="sm"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Show
          when={props.showCustomDeadline()}
          fallback={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                props.setShowCustomDeadline(true);
              }}
              class="text-muted-foreground h-8 px-2 text-xs"
            >
              Custom
            </Button>
          }
        >
          <div class="flex items-center gap-1">
            <Input
              type="number"
              min={MIN_DEADLINE_MINUTES}
              max={MAX_DEADLINE_MINUTES}
              step={1}
              value={props.customDeadline()}
              onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) => {
                props.setCustomDeadline(e.currentTarget.value);
              }}
              placeholder="20"
              class="h-8 w-16"
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Enter') props.handleCustomDeadlineSubmit();
                if (e.key === 'Escape') props.setShowCustomDeadline(false);
              }}
              autofocus
            />
            <span class="text-muted-foreground text-sm">min</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={props.handleCustomDeadlineSubmit}
              class="h-8 px-2"
            >
              Set
            </Button>
          </div>
        </Show>
      </div>

      {/* Deadline Info */}
      <p class="text-muted-foreground mt-1 text-xs">
        Transaction will revert if not confirmed within {props.deadlineMinutes} minutes
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface TransactionSettingsPanelProps {
  /** Whether to show deadline settings (hidden in simple mode by default) */
  showDeadline?: boolean;
  /** Show as compact inline version */
  compact?: boolean;
  /** Market address for smart slippage calculation (Error Prevention) */
  marketAddress?: string | undefined;
  /** Smart slippage data (optional) */
  smartSlippage?: {
    isLoading: boolean;
    recommendedBps: number;
    confidence: ConfidenceLevel;
    reason: string;
    factors: {
      hasMarketData: boolean;
    };
  };
}

/**
 * Transaction Settings Panel
 *
 * Displays slippage and deadline settings with preset options
 * and custom input. Shows deadline settings only in advanced mode.
 *
 * @see Security Audit M-06 - Router Deadline Protection
 */
export function TransactionSettingsPanel(props: TransactionSettingsPanelProps): JSX.Element {
  const { isAdvanced } = useUIMode();
  const { slippageBps, deadlineMinutes, setSlippageBps, setDeadlineMinutes, resetToDefaults } =
    useTransactionSettings();

  // Default smart slippage if not provided
  const smartSlippage = createMemo(() => props.smartSlippage ?? {
    isLoading: false,
    recommendedBps: DEFAULT_SLIPPAGE_BPS,
    confidence: 'medium' as ConfidenceLevel,
    reason: 'Standard slippage tolerance',
    factors: { hasMarketData: false },
  });

  // Local state for custom inputs
  const [customSlippage, setCustomSlippage] = createSignal<string>('');
  const [customDeadline, setCustomDeadline] = createSignal<string>('');
  const [showCustomSlippage, setShowCustomSlippage] = createSignal(false);
  const [showCustomDeadline, setShowCustomDeadline] = createSignal(false);

  // Determine if deadline should be shown
  const shouldShowDeadline = createMemo(() => props.showDeadline ?? isAdvanced());

  // Check if current value matches a preset
  const isSlippagePreset = createMemo(() =>
    SLIPPAGE_OPTIONS.some((opt: (typeof SLIPPAGE_OPTIONS)[number]) => opt.value === slippageBps())
  );
  const isDeadlinePreset = createMemo(() =>
    DEADLINE_OPTIONS.some((opt: (typeof DEADLINE_OPTIONS)[number]) => opt.value === deadlineMinutes())
  );

  // Handle custom slippage submit with confirmation feedback
  const handleCustomSlippageSubmit = (): void => {
    const value = Number.parseFloat(customSlippage());
    if (
      !Number.isNaN(value) &&
      value >= MIN_SLIPPAGE_BPS / 100 &&
      value <= MAX_SLIPPAGE_BPS / 100
    ) {
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
    const value = Number.parseInt(customDeadline(), 10);
    if (!Number.isNaN(value) && value >= MIN_DEADLINE_MINUTES && value <= MAX_DEADLINE_MINUTES) {
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
  const isModified = createMemo(
    () => slippageBps() !== DEFAULT_SLIPPAGE_BPS || deadlineMinutes() !== DEFAULT_DEADLINE_MINUTES
  );

  // Handle slippage preset change with confirmation feedback
  const handleSlippagePresetChange = (value: number, label: string): void => {
    setSlippageBps(value);
    setShowCustomSlippage(false);
    toast.success(`Slippage set to ${label}`, {
      description: `Transactions will fail if price moves more than ${(value / 100).toFixed(1)}%`,
      duration: 2000,
    });
  };

  // Handle deadline preset change with confirmation feedback
  const handleDeadlinePresetChange = (value: number): void => {
    setDeadlineMinutes(value);
    setShowCustomDeadline(false);
    toast.success(`Deadline set to ${String(value)} minutes`, {
      description: `Transactions will expire if not confirmed within ${String(value)} min`,
      duration: 2000,
    });
  };

  // Handle applying smart slippage recommendation
  const handleApplySmartSlippage = (): void => {
    if (!smartSlippage().factors.hasMarketData) return;

    const bps = smartSlippage().recommendedBps;
    setSlippageBps(bps);
    setShowCustomSlippage(false);
    toast.success(`Smart slippage: ${formatSlippagePercent(bps)}`, {
      description: smartSlippage().reason,
      duration: 3000,
    });
  };

  // Check if current slippage matches smart recommendation (within 5 BPS tolerance)
  const isUsingSmartSlippage = createMemo(
    () =>
      smartSlippage().factors.hasMarketData &&
      Math.abs(slippageBps() - smartSlippage().recommendedBps) <= 5
  );

  // Compact view
  if (props.compact) {
    return (
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="text-muted-foreground">
          Slippage: {(slippageBps() / 100).toFixed(1)}%{' '}
          <span class="text-xs opacity-70">({getSlippageLabel(slippageBps())})</span>
        </span>
        <Show when={shouldShowDeadline()}>
          <span class="text-muted-foreground">Deadline: {deadlineMinutes()}m</span>
        </Show>
      </div>
    );
  }

  return (
    <div class="space-y-4">
      {/* Slippage Settings */}
      <div>
        <div class="text-muted-foreground mb-2 flex items-center justify-between text-sm">
          <span>Slippage Tolerance</span>
          <SlippageStatusBadge
            status={computeSlippageStatus(isUsingSmartSlippage(), isSlippagePreset(), slippageBps())}
            slippageBps={slippageBps()}
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center gap-2">
            {/* Smart Slippage Button (when market data available) */}
            <Show when={props.marketAddress}>
              <ToggleGroupItem
                pressed={isUsingSmartSlippage()}
                onPressedChange={handleApplySmartSlippage}
                disabled={smartSlippage().isLoading || !smartSlippage().factors.hasMarketData}
                variant="outline"
                size="sm"
                class="shrink-0"
                aria-label="Apply smart slippage based on market conditions"
              >
                <Show
                  when={!smartSlippage().isLoading}
                  fallback={<Skeleton class="h-4 w-8" />}
                >
                  <span class="flex items-center gap-1">
                    <SparklesIcon class="size-3" />
                    <span class="font-medium">Auto</span>
                  </span>
                </Show>
              </ToggleGroupItem>
            </Show>

            <ToggleGroup class="flex flex-1 gap-1">
              {SLIPPAGE_OPTIONS.map((option: (typeof SLIPPAGE_OPTIONS)[number]) => (
                <ToggleGroupItem
                  pressed={
                    slippageBps() === option.value && !showCustomSlippage() && !isUsingSmartSlippage()
                  }
                  onPressedChange={() => {
                    handleSlippagePresetChange(option.value, option.label);
                  }}
                  variant="outline"
                  size="sm"
                  class="flex-1"
                  aria-label={`${option.label} slippage: ${option.percent}`}
                >
                  <span class="flex flex-col items-center gap-0.5">
                    <span class="font-medium">{option.label}</span>
                    <span class="text-muted-foreground text-[10px]">{option.percent}</span>
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <Show
              when={showCustomSlippage()}
              fallback={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCustomSlippage(true);
                  }}
                  class="text-muted-foreground h-8 px-2 text-xs"
                >
                  Custom
                </Button>
              }
            >
              <div class="flex items-center gap-1">
                <Input
                  type="number"
                  min={MIN_SLIPPAGE_BPS / 100}
                  max={MAX_SLIPPAGE_BPS / 100}
                  step={0.1}
                  value={customSlippage()}
                  onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) => {
                    setCustomSlippage(e.currentTarget.value);
                  }}
                  placeholder="0.5"
                  class="h-8 w-16"
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === 'Enter') handleCustomSlippageSubmit();
                    if (e.key === 'Escape') setShowCustomSlippage(false);
                  }}
                  autofocus
                />
                <span class="text-muted-foreground text-sm">%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCustomSlippageSubmit}
                  class="h-8 px-2"
                >
                  Set
                </Button>
              </div>
            </Show>
          </div>

          {/* Show description for smart slippage or selected preset */}
          <SlippageDescription
            isUsingSmartSlippage={isUsingSmartSlippage()}
            isSlippagePreset={isSlippagePreset()}
            showCustomSlippage={showCustomSlippage()}
            slippageBps={slippageBps()}
            smartSlippage={smartSlippage()}
          />
        </div>

        {/* Slippage Warning */}
        <SlippageWarning slippageBps={slippageBps()} />
      </div>

      {/* Deadline Settings (Advanced mode only by default) */}
      <Show when={shouldShowDeadline()}>
        <DeadlineSettings
          deadlineMinutes={deadlineMinutes()}
          isDeadlinePreset={isDeadlinePreset()}
          showCustomDeadline={showCustomDeadline}
          customDeadline={customDeadline}
          setCustomDeadline={setCustomDeadline}
          setShowCustomDeadline={setShowCustomDeadline}
          handleDeadlinePresetChange={handleDeadlinePresetChange}
          handleCustomDeadlineSubmit={handleCustomDeadlineSubmit}
        />
      </Show>

      {/* Reset Button */}
      <Show when={isModified()}>
        <Button variant="ghost" size="sm" onClick={resetToDefaults} class="text-xs">
          Reset to defaults
        </Button>
      </Show>
    </div>
  );
}

/**
 * Compact inline display of current transaction settings
 */
export function TransactionSettingsDisplay(): JSX.Element {
  const { isAdvanced } = useUIMode();
  const { slippageBps, slippagePercent, deadlineMinutes } = useTransactionSettings();

  return (
    <div class="text-muted-foreground flex items-center gap-3 text-sm">
      <span>
        Slippage: {slippagePercent()}{' '}
        <span class="text-xs opacity-70">({getSlippageLabel(slippageBps())})</span>
      </span>
      <Show when={isAdvanced()}>
        <span>Deadline: {deadlineMinutes()}m</span>
      </Show>
    </div>
  );
}
