'use client';

import type { ReactNode } from 'react';

import { TreasuryDashboard } from '@/page-compositions/admin-treasury';

/**
 * Admin-only treasury dashboard page.
 *
 * Shows pending treasury yield across all YT contracts.
 * Only accessible to protocol owners (YT contract admins).
 *
 * @route /admin/treasury
 */
export default function TreasuryPage(): ReactNode {
  return <TreasuryDashboard />;
}
