'use client';

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
