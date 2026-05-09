import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { MintPage } from '@/page-compositions/mint';

export const metadata: Metadata = {
  title: 'Mint',
  description: 'Mint Principal and Yield Tokens from supported yield-bearing assets.',
};

export default function MintRoute(): ReactNode {
  return <MintPage />;
}
