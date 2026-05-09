import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { PortfolioPage } from '@/page-compositions/portfolio';

export const metadata: Metadata = {
  title: 'Portfolio',
  description: 'Track Horizon positions, claim yield, redeem matured assets, and manage rewards.',
};

export default function PortfolioRoute(): ReactNode {
  return <PortfolioPage />;
}
