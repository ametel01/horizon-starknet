import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AnalyticsPage } from '@/page-compositions/analytics';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Explore Horizon Protocol TVL, volume, fee, market, and execution-quality metrics.',
};

export default function AnalyticsRoute(): ReactNode {
  return <AnalyticsPage />;
}
