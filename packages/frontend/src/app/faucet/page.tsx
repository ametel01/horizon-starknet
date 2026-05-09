import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { FaucetPage } from '@/page-compositions/faucet';

export const metadata: Metadata = {
  title: 'Faucet',
  description: 'Request Horizon test tokens for trying protocol flows on supported networks.',
};

export default function FaucetRoute(): ReactNode {
  return <FaucetPage />;
}
