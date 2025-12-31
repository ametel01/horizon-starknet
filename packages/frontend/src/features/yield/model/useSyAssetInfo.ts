'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useStarknet } from '@features/wallet';
import { getSYContract } from '@shared/starknet/contracts';

/** Asset type as defined in the SY contract */
export type AssetType = 'Token' | 'Liquidity';

export interface SyAssetInfo {
  /** The type of underlying asset */
  assetType: AssetType;
  /** The underlying asset contract address */
  underlyingAddress: string;
  /** Decimals of the underlying asset */
  decimals: number;
}

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
 * Convert contract address to hex string format.
 * Handles both bigint and string representations.
 */
function toAddressString(address: unknown): string {
  if (typeof address === 'string') {
    return address.startsWith('0x') ? address : `0x${address}`;
  }
  if (typeof address === 'bigint') {
    return '0x' + address.toString(16).padStart(64, '0');
  }
  return '0x0';
}

/**
 * Hook to fetch SY asset info (type, underlying address, decimals).
 *
 * The asset_info function returns metadata about the underlying asset
 * that the SY token wraps. This is useful for display purposes and
 * for understanding the nature of the yield-bearing asset.
 *
 * @param syAddress - The SY contract address
 * @returns Query result with asset info
 *
 * @example
 * ```typescript
 * const { data: assetInfo } = useSyAssetInfo(syAddress);
 *
 * if (assetInfo) {
 *   console.log(`Type: ${assetInfo.assetType}`); // "Token" or "Liquidity"
 *   console.log(`Underlying: ${assetInfo.underlyingAddress}`);
 *   console.log(`Decimals: ${assetInfo.decimals}`);
 * }
 * ```
 */
export function useSyAssetInfo(syAddress: string | undefined): UseQueryResult<SyAssetInfo | null> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['sy', 'asset-info', syAddress],
    queryFn: async (): Promise<SyAssetInfo | null> => {
      if (syAddress === undefined) {
        return null;
      }

      const sy = getSYContract(syAddress, provider);
      const info = await sy.asset_info();

      // info is tuple returned as indexed object: { 0: AssetType, 1: ContractAddress, 2: u8 }
      const assetTypeVariant = info[0];
      const underlying = info[1];
      const decimals = info[2];

      return {
        assetType: parseAssetType(assetTypeVariant),
        underlyingAddress: toAddressString(underlying),
        decimals: Number(decimals),
      };
    },
    enabled: syAddress !== undefined,
    staleTime: Infinity, // Asset info never changes after deployment
  });
}

/**
 * Hook to get just the asset type.
 * Convenience wrapper for checking if asset is Token or Liquidity.
 *
 * @param syAddress - The SY contract address
 * @returns The asset type or undefined if not loaded
 */
export function useSyAssetType(syAddress: string | undefined): AssetType | undefined {
  const { data } = useSyAssetInfo(syAddress);
  return data?.assetType;
}

/**
 * Hook to get the underlying asset address.
 *
 * @param syAddress - The SY contract address
 * @returns The underlying address or undefined if not loaded
 */
export function useSyUnderlyingAddress(syAddress: string | undefined): string | undefined {
  const { data } = useSyAssetInfo(syAddress);
  return data?.underlyingAddress;
}
