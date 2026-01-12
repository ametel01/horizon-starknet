import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import type { ParentProps } from 'solid-js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
      retry: 1,
      // Note: solid-query uses 'reconcile' instead of 'structuralSharing'
      // and defaults to false, which prevents BigInt serialization issues
      reconcile: false,
    },
  },
});

export function QueryProvider(props: ParentProps): ReturnType<typeof QueryClientProvider> {
  return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
}
