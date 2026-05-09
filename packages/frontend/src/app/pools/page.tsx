import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { PoolsPage } from '@/page-compositions/pools';

export const metadata: Metadata = {
  title: 'Pools',
  description: 'Add and remove liquidity in Horizon PT/SY markets.',
};

export default function PoolsRoute(): ReactNode {
  return <PoolsPage />;
}
