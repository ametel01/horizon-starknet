import { cleanup, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DEADLINE_MINUTES,
  DEFAULT_SLIPPAGE_BPS,
  formatSlippagePercent,
  getSlippageLabel,
  Providers,
  ThemeProvider,
  TransactionSettingsProvider,
  UIModeProvider,
  useDeadline,
  useSlippageWad,
  useTheme,
  useTransactionSettings,
  useUIMode,
} from './index';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Helper component to test context access
function ThemeConsumer() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme()}</span>
      <span data-testid="resolved-theme">{resolvedTheme()}</span>
      <button type="button" data-testid="set-dark" onClick={() => setTheme('dark')}>
        Set Dark
      </button>
      <button type="button" data-testid="set-light" onClick={() => setTheme('light')}>
        Set Light
      </button>
    </div>
  );
}

function UIModeConsumer() {
  const { mode, isSimple, isAdvanced, setMode, toggleMode } = useUIMode();
  return (
    <div>
      <span data-testid="mode">{mode()}</span>
      <span data-testid="is-simple">{isSimple().toString()}</span>
      <span data-testid="is-advanced">{isAdvanced().toString()}</span>
      <button type="button" data-testid="set-advanced" onClick={() => setMode('advanced')}>
        Set Advanced
      </button>
      <button type="button" data-testid="toggle" onClick={toggleMode}>
        Toggle
      </button>
    </div>
  );
}

function TransactionSettingsConsumer() {
  const {
    slippageBps,
    deadlineMinutes,
    slippagePercent,
    slippageDecimal,
    deadlineSeconds,
    setSlippageBps,
    setDeadlineMinutes,
    resetToDefaults,
  } = useTransactionSettings();

  return (
    <div>
      <span data-testid="slippage-bps">{slippageBps()}</span>
      <span data-testid="deadline-minutes">{deadlineMinutes()}</span>
      <span data-testid="slippage-percent">{slippagePercent()}</span>
      <span data-testid="slippage-decimal">{slippageDecimal()}</span>
      <span data-testid="deadline-seconds">{deadlineSeconds()}</span>
      <button type="button" data-testid="set-slippage-100" onClick={() => setSlippageBps(100)}>
        Set 1%
      </button>
      <button type="button" data-testid="set-deadline-30" onClick={() => setDeadlineMinutes(30)}>
        Set 30min
      </button>
      <button type="button" data-testid="reset" onClick={resetToDefaults}>
        Reset
      </button>
    </div>
  );
}

function SlippageWadConsumer() {
  const slippageWad = useSlippageWad();
  return <span data-testid="slippage-wad">{slippageWad().toString()}</span>;
}

function DeadlineConsumer() {
  const getDeadline = useDeadline();
  const [deadline, setDeadline] = createSignal<string>('');

  return (
    <div>
      <span data-testid="deadline">{deadline()}</span>
      <button
        type="button"
        data-testid="get-deadline"
        onClick={() => setDeadline(getDeadline().toString())}
      >
        Get Deadline
      </button>
    </div>
  );
}

// Test component that uses all contexts to verify composition
function AllContextsConsumer() {
  const theme = useTheme();
  const uiMode = useUIMode();
  const txSettings = useTransactionSettings();

  return (
    <div>
      <span data-testid="all-theme">{theme.resolvedTheme()}</span>
      <span data-testid="all-mode">{uiMode.mode()}</span>
      <span data-testid="all-slippage">{txSettings.slippageBps()}</span>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorageMock.clear();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('provides default theme values', () => {
    render(() => (
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    ));

    expect(screen.getByTestId('theme').textContent).toBe('system');
    // In jsdom, matchMedia returns false for dark mode, so system resolves to light
    expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
  });

  it('allows setting theme to dark', async () => {
    render(() => (
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    ));

    screen.getByTestId('set-dark').click();

    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
  });

  it('allows setting theme to light', async () => {
    render(() => (
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    ));

    screen.getByTestId('set-light').click();

    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
  });

  it('persists theme to localStorage', () => {
    render(() => (
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    ));

    screen.getByTestId('set-dark').click();

    expect(localStorageMock.getItem('horizon-theme')).toBe('dark');
  });

  it('throws when useTheme is used outside provider', () => {
    expect(() => {
      render(() => <ThemeConsumer />);
    }).toThrow('useTheme must be used within a ThemeProvider');
  });
});

describe('UIModeProvider', () => {
  beforeEach(() => {
    localStorageMock.clear();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('provides default mode as simple', () => {
    render(() => (
      <UIModeProvider>
        <UIModeConsumer />
      </UIModeProvider>
    ));

    expect(screen.getByTestId('mode').textContent).toBe('simple');
    expect(screen.getByTestId('is-simple').textContent).toBe('true');
    expect(screen.getByTestId('is-advanced').textContent).toBe('false');
  });

  it('allows setting mode to advanced', () => {
    render(() => (
      <UIModeProvider>
        <UIModeConsumer />
      </UIModeProvider>
    ));

    screen.getByTestId('set-advanced').click();

    expect(screen.getByTestId('mode').textContent).toBe('advanced');
    expect(screen.getByTestId('is-simple').textContent).toBe('false');
    expect(screen.getByTestId('is-advanced').textContent).toBe('true');
  });

  it('toggles mode correctly', () => {
    render(() => (
      <UIModeProvider>
        <UIModeConsumer />
      </UIModeProvider>
    ));

    // Start as simple
    expect(screen.getByTestId('mode').textContent).toBe('simple');

    // Toggle to advanced
    screen.getByTestId('toggle').click();
    expect(screen.getByTestId('mode').textContent).toBe('advanced');

    // Toggle back to simple
    screen.getByTestId('toggle').click();
    expect(screen.getByTestId('mode').textContent).toBe('simple');
  });

  it('respects defaultMode prop', () => {
    render(() => (
      <UIModeProvider defaultMode="advanced">
        <UIModeConsumer />
      </UIModeProvider>
    ));

    expect(screen.getByTestId('mode').textContent).toBe('advanced');
  });

  it('persists mode to localStorage', () => {
    render(() => (
      <UIModeProvider>
        <UIModeConsumer />
      </UIModeProvider>
    ));

    screen.getByTestId('set-advanced').click();

    expect(localStorageMock.getItem('horizon-ui-mode')).toBe('advanced');
  });

  it('throws when useUIMode is used outside provider', () => {
    expect(() => {
      render(() => <UIModeConsumer />);
    }).toThrow('useUIMode must be used within a UIModeProvider');
  });
});

describe('TransactionSettingsProvider', () => {
  beforeEach(() => {
    localStorageMock.clear();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('provides default values', () => {
    render(() => (
      <TransactionSettingsProvider>
        <TransactionSettingsConsumer />
      </TransactionSettingsProvider>
    ));

    expect(screen.getByTestId('slippage-bps').textContent).toBe(DEFAULT_SLIPPAGE_BPS.toString());
    expect(screen.getByTestId('deadline-minutes').textContent).toBe(
      DEFAULT_DEADLINE_MINUTES.toString()
    );
    expect(screen.getByTestId('slippage-percent').textContent).toBe('0.5%');
    expect(screen.getByTestId('slippage-decimal').textContent).toBe('0.005');
    expect(screen.getByTestId('deadline-seconds').textContent).toBe(
      (DEFAULT_DEADLINE_MINUTES * 60).toString()
    );
  });

  it('allows setting slippage', () => {
    render(() => (
      <TransactionSettingsProvider>
        <TransactionSettingsConsumer />
      </TransactionSettingsProvider>
    ));

    screen.getByTestId('set-slippage-100').click();

    expect(screen.getByTestId('slippage-bps').textContent).toBe('100');
    expect(screen.getByTestId('slippage-percent').textContent).toBe('1%');
    expect(screen.getByTestId('slippage-decimal').textContent).toBe('0.01');
  });

  it('allows setting deadline', () => {
    render(() => (
      <TransactionSettingsProvider>
        <TransactionSettingsConsumer />
      </TransactionSettingsProvider>
    ));

    screen.getByTestId('set-deadline-30').click();

    expect(screen.getByTestId('deadline-minutes').textContent).toBe('30');
    expect(screen.getByTestId('deadline-seconds').textContent).toBe('1800');
  });

  it('resets to defaults', () => {
    render(() => (
      <TransactionSettingsProvider>
        <TransactionSettingsConsumer />
      </TransactionSettingsProvider>
    ));

    // Change values
    screen.getByTestId('set-slippage-100').click();
    screen.getByTestId('set-deadline-30').click();

    // Verify changed
    expect(screen.getByTestId('slippage-bps').textContent).toBe('100');
    expect(screen.getByTestId('deadline-minutes').textContent).toBe('30');

    // Reset
    screen.getByTestId('reset').click();

    expect(screen.getByTestId('slippage-bps').textContent).toBe(DEFAULT_SLIPPAGE_BPS.toString());
    expect(screen.getByTestId('deadline-minutes').textContent).toBe(
      DEFAULT_DEADLINE_MINUTES.toString()
    );
  });

  it('persists settings to localStorage', () => {
    render(() => (
      <TransactionSettingsProvider>
        <TransactionSettingsConsumer />
      </TransactionSettingsProvider>
    ));

    screen.getByTestId('set-slippage-100').click();

    const stored = JSON.parse(localStorageMock.getItem('horizon-tx-settings') ?? '{}');
    expect(stored.slippageBps).toBe(100);
  });

  it('throws when useTransactionSettings is used outside provider', () => {
    expect(() => {
      render(() => <TransactionSettingsConsumer />);
    }).toThrow('useTransactionSettings must be used within a TransactionSettingsProvider');
  });
});

describe('useSlippageWad', () => {
  beforeEach(() => {
    localStorageMock.clear();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('returns slippage in WAD format', () => {
    render(() => (
      <TransactionSettingsProvider>
        <SlippageWadConsumer />
      </TransactionSettingsProvider>
    ));

    // Default is 50 bps = 0.005 = 5000000000000000 in WAD (0.005 * 10^18)
    const expected = BigInt(Math.floor(0.005 * 1e18));
    expect(screen.getByTestId('slippage-wad').textContent).toBe(expected.toString());
  });
});

describe('useDeadline', () => {
  beforeEach(() => {
    localStorageMock.clear();
    cleanup();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('returns a function that computes deadline timestamp', () => {
    const mockTime = 1700000000000; // Fixed timestamp
    vi.setSystemTime(mockTime);

    render(() => (
      <TransactionSettingsProvider>
        <DeadlineConsumer />
      </TransactionSettingsProvider>
    ));

    screen.getByTestId('get-deadline').click();

    // Expected: current time in seconds + deadline seconds (20 min * 60)
    const expectedDeadline = BigInt(Math.floor(mockTime / 1000) + DEFAULT_DEADLINE_MINUTES * 60);
    expect(screen.getByTestId('deadline').textContent).toBe(expectedDeadline.toString());
  });
});

describe('Helper functions', () => {
  describe('formatSlippagePercent', () => {
    it('formats integer percentages without decimals', () => {
      expect(formatSlippagePercent(100)).toBe('1%');
      expect(formatSlippagePercent(200)).toBe('2%');
    });

    it('formats fractional percentages with one decimal', () => {
      expect(formatSlippagePercent(50)).toBe('0.5%');
      expect(formatSlippagePercent(150)).toBe('1.5%');
    });

    it('formats small values', () => {
      expect(formatSlippagePercent(10)).toBe('0.1%');
      // 1 bps = 0.01%, formatted with 1 decimal place
      expect(formatSlippagePercent(1)).toBe('0.0%');
    });
  });

  describe('getSlippageLabel', () => {
    it('returns correct labels for different ranges', () => {
      expect(getSlippageLabel(10)).toBe('very low');
      expect(getSlippageLabel(20)).toBe('low');
      expect(getSlippageLabel(50)).toBe('standard');
      expect(getSlippageLabel(100)).toBe('moderate');
      expect(getSlippageLabel(200)).toBe('high');
      expect(getSlippageLabel(500)).toBe('very high');
    });
  });
});

describe('Providers composition', () => {
  beforeEach(() => {
    localStorageMock.clear();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('composes all providers correctly with Providers component', () => {
    render(() => (
      <Providers>
        <AllContextsConsumer />
      </Providers>
    ));

    // All contexts should be accessible
    // In jsdom, matchMedia returns false for dark mode, so system resolves to light
    expect(screen.getByTestId('all-theme').textContent).toBe('light');
    expect(screen.getByTestId('all-mode').textContent).toBe('simple');
    expect(screen.getByTestId('all-slippage').textContent).toBe(DEFAULT_SLIPPAGE_BPS.toString());
  });

  it('maintains context isolation - changes in one do not affect others', () => {
    function CompositionTestConsumer() {
      const theme = useTheme();
      const uiMode = useUIMode();
      const txSettings = useTransactionSettings();

      return (
        <div>
          <span data-testid="theme-val">{theme.resolvedTheme()}</span>
          <span data-testid="mode-val">{uiMode.mode()}</span>
          <span data-testid="slippage-val">{txSettings.slippageBps()}</span>
          <button type="button" data-testid="change-theme" onClick={() => theme.setTheme('light')}>
            Change Theme
          </button>
          <button
            type="button"
            data-testid="change-mode"
            onClick={() => uiMode.setMode('advanced')}
          >
            Change Mode
          </button>
          <button
            type="button"
            data-testid="change-slippage"
            onClick={() => txSettings.setSlippageBps(100)}
          >
            Change Slippage
          </button>
        </div>
      );
    }

    render(() => (
      <Providers>
        <CompositionTestConsumer />
      </Providers>
    ));

    // Initial values (jsdom matchMedia returns false, so system resolves to light)
    expect(screen.getByTestId('theme-val').textContent).toBe('light');
    expect(screen.getByTestId('mode-val').textContent).toBe('simple');
    expect(screen.getByTestId('slippage-val').textContent).toBe(DEFAULT_SLIPPAGE_BPS.toString());

    // Change theme to dark - others should stay the same
    screen.getByTestId('change-theme').click();
    // After explicitly setting light, it stays light
    expect(screen.getByTestId('theme-val').textContent).toBe('light');
    expect(screen.getByTestId('mode-val').textContent).toBe('simple');
    expect(screen.getByTestId('slippage-val').textContent).toBe(DEFAULT_SLIPPAGE_BPS.toString());

    // Change mode - others should stay the same
    screen.getByTestId('change-mode').click();
    expect(screen.getByTestId('theme-val').textContent).toBe('light');
    expect(screen.getByTestId('mode-val').textContent).toBe('advanced');
    expect(screen.getByTestId('slippage-val').textContent).toBe(DEFAULT_SLIPPAGE_BPS.toString());

    // Change slippage - others should stay the same
    screen.getByTestId('change-slippage').click();
    expect(screen.getByTestId('theme-val').textContent).toBe('light');
    expect(screen.getByTestId('mode-val').textContent).toBe('advanced');
    expect(screen.getByTestId('slippage-val').textContent).toBe('100');
  });

  it('nested consumers can access all parent contexts', () => {
    function NestedConsumer() {
      return (
        <div data-testid="outer">
          <ThemeConsumer />
          <div data-testid="inner">
            <UIModeConsumer />
            <div data-testid="innermost">
              <TransactionSettingsConsumer />
            </div>
          </div>
        </div>
      );
    }

    render(() => (
      <Providers>
        <NestedConsumer />
      </Providers>
    ));

    // All nested consumers should have access to their contexts
    expect(screen.getByTestId('theme').textContent).toBe('system');
    expect(screen.getByTestId('mode').textContent).toBe('simple');
    expect(screen.getByTestId('slippage-bps').textContent).toBe(DEFAULT_SLIPPAGE_BPS.toString());
  });
});
