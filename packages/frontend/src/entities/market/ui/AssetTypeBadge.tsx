'use client';

import { type AssetType, useSyAssetType } from '@features/yield';
import { Badge } from '@shared/ui/badge';
import { Skeleton } from '@shared/ui/Skeleton';
import { Coins, Droplets } from 'lucide-react';
import { memo, type ReactNode } from 'react';

interface AssetTypeBadgeProps {
  /** SY contract address to fetch asset type from */
  syAddress: string;
  /** Additional CSS classes */
  className?: string | undefined;
}

/**
 * Badge configuration per asset type.
 * Token = single yield-bearing asset (e.g., stETH, aUSDC)
 * Liquidity = LP token from DEX/AMM (e.g., UniV2 LP)
 */
const ASSET_TYPE_CONFIG: Record<AssetType, { icon: typeof Coins; label: string }> = {
  Token: {
    icon: Coins,
    label: 'Token',
  },
  Liquidity: {
    icon: Droplets,
    label: 'LP',
  },
};

/**
 * AssetTypeBadge - Displays whether the underlying asset is a Token or Liquidity position.
 *
 * This helps users understand what type of yield-bearing asset backs the PT/YT:
 * - **Token**: Standard yield-bearing tokens like stETH, sSTRK, aUSDC
 * - **Liquidity (LP)**: DEX/AMM LP tokens that earn trading fees
 *
 * The badge fetches asset info from the SY contract's `asset_info()` function
 * which returns a Cairo enum (Token | Liquidity).
 *
 * @example
 * ```tsx
 * <AssetTypeBadge syAddress={market.syAddress} />
 * ```
 */
export const AssetTypeBadge = memo(function AssetTypeBadge({
  syAddress,
  className,
}: AssetTypeBadgeProps): ReactNode {
  const assetType = useSyAssetType(syAddress);

  // Loading state - show skeleton
  if (assetType === undefined) {
    return <Skeleton className="h-5 w-14 rounded-full" />;
  }

  const config = ASSET_TYPE_CONFIG[assetType];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={className}>
      <Icon className="size-3" aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
});
