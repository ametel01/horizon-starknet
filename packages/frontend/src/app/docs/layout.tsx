import type { Metadata } from 'next';

import { DocsLayout } from '@/components/docs/DocsLayout';

export const metadata: Metadata = {
  title: 'Documentation | Horizon Protocol',
  description: 'Learn how to use Horizon Protocol for yield tokenization on Starknet',
};

export default function DocsRootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  return <DocsLayout>{children}</DocsLayout>;
}
