'use client';

// IMPORTANT: Import BigInt polyfill before any React Query code
import '@/lib/polyfills/bigint-json';

import { QueryProvider } from './QueryProvider';
import { StarknetProvider } from './StarknetProvider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps): React.ReactNode {
  return (
    <QueryProvider>
      <StarknetProvider>{children}</StarknetProvider>
    </QueryProvider>
  );
}
