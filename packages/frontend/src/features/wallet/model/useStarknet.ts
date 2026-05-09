'use client';

import { use } from 'react';

import { StarknetContext, type StarknetContextValue } from '@/providers/StarknetProvider';

export function useStarknet(): StarknetContextValue {
  const context = use(StarknetContext);

  if (!context) {
    throw new Error('useStarknet must be used within a StarknetProvider');
  }

  return context;
}
