import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { HomePageClient } from './home-page-client';

export const metadata: Metadata = {
  title: 'Horizon Protocol',
  description:
    'Split yield-bearing assets into Principal and Yield Tokens on Starknet and manage fixed-yield positions.',
};

export default function HomePage(): ReactNode {
  return <HomePageClient />;
}
