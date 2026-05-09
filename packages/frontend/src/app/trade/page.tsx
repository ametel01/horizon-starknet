import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { TradePage } from '@/page-compositions/trade';

export const metadata: Metadata = {
  title: 'Trade',
  description: 'Trade Principal Tokens and Yield Tokens with slippage-protected Horizon flows.',
};

export default function TradeRoute(): ReactNode {
  return <TradePage />;
}
