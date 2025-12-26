'use client';

// IMPORTANT: Import BigInt polyfill before any React Query code
import '@shared/lib/polyfills/bigint-json';

import { TransactionSettingsProvider } from '@/contexts/transaction-settings-context';
import { UIModeProvider } from '@shared/theme/ui-mode-context';

import { QueryProvider } from './QueryProvider';
import { StarknetProvider } from './StarknetProvider';
import { ThemeProvider } from './theme-provider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps): React.ReactNode {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryProvider>
        <StarknetProvider>
          <UIModeProvider>
            <TransactionSettingsProvider>{children}</TransactionSettingsProvider>
          </UIModeProvider>
        </StarknetProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
