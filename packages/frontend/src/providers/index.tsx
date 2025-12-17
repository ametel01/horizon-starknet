'use client';

// IMPORTANT: Import BigInt polyfill before any React Query code
import '@/lib/polyfills/bigint-json';

import { UIModeProvider } from '@/contexts/ui-mode-context';

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
          <UIModeProvider>{children}</UIModeProvider>
        </StarknetProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
