import { cn } from '@shared/lib/utils';
import { getSYContract } from '@shared/starknet/contracts';
import { Badge } from '@shared/ui/Badge';
import { Skeleton } from '@shared/ui/Skeleton';
import { createQuery } from '@tanstack/solid-query';
import { type Accessor, createMemo, type JSX, Show } from 'solid-js';

import { useStarknet } from '@/features/wallet';

/** Asset type as defined in the SY contract */
export type AssetType = 'Token' | 'Liquidity';

/**
 * Parse Cairo enum variant to TypeScript type.
 * Cairo enums are represented as objects with the variant name as key.
 */
function parseAssetType(variant: unknown): AssetType {
  if (variant !== null && typeof variant === 'object') {
    if ('Token' in variant) return 'Token';
    if ('Liquidity' in variant) return 'Liquidity';
  }
  // Default fallback
  return 'Token';
}

/**
 * Hook to fetch SY asset type from the contract.
 */
function useSyAssetType(syAddress: Accessor<string | undefined>): {
  assetType: Accessor<AssetType | undefined>;
  isLoading: Accessor<boolean>;
} {
  const { provider } = useStarknet();

  const query = createQuery(() => ({
    queryKey: ['sy', 'asset-type', syAddress()],
    queryFn: async (): Promise<AssetType> => {
      const address = syAddress();
      if (!address) {
        throw new Error('SY address is required');
      }

      const sy = getSYContract(address, provider);
      const info = await sy.asset_info();

      // info is tuple returned as indexed object: { 0: AssetType, 1: ContractAddress, 2: u8 }
      const assetTypeVariant = info[0];
      return parseAssetType(assetTypeVariant);
    },
    enabled: !!syAddress(),
    staleTime: Number.POSITIVE_INFINITY, // Asset info never changes after deployment
  }));

  return {
    assetType: createMemo(() => query.data),
    isLoading: createMemo(() => query.isLoading),
  };
}

interface AssetTypeBadgeProps {
  /** SY contract address to fetch asset type from */
  syAddress: string;
  /** Additional CSS classes */
  class?: string;
}

/** Coins icon SVG */
function CoinsIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}

/** Droplets icon SVG */
function DropletsIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
      <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
    </svg>
  );
}

/**
 * Badge configuration per asset type.
 * Token = single yield-bearing asset (e.g., stETH, aUSDC)
 * Liquidity = LP token from DEX/AMM (e.g., UniV2 LP)
 */
const ASSET_TYPE_CONFIG: Record<
  AssetType,
  { icon: (props: JSX.SvgSVGAttributes<SVGSVGElement>) => JSX.Element; label: string }
> = {
  Token: {
    icon: CoinsIcon,
    label: 'Token',
  },
  Liquidity: {
    icon: DropletsIcon,
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
export function AssetTypeBadge(props: AssetTypeBadgeProps): JSX.Element {
  const syAddressAccessor = createMemo(() => props.syAddress);
  const { assetType, isLoading } = useSyAssetType(syAddressAccessor);

  return (
    <Show
      when={!isLoading()}
      fallback={<Skeleton class="h-5 w-14 rounded-full" />}
    >
      <Show when={assetType()} keyed>
        {(type) => {
          const config = ASSET_TYPE_CONFIG[type];
          const Icon = config.icon;

          return (
            <Badge variant="outline" class={cn(props.class)}>
              <Icon class="h-3 w-3" />
              <span>{config.label}</span>
            </Badge>
          );
        }}
      </Show>
    </Show>
  );
}
