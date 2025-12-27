'use client';

import BigNumber from 'bignumber.js';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import type { MarketData } from '@entities/market';
import {
  buildRemoveLiquidityCalls,
  calculateMinOutputs,
  useRemoveLiquidity,
} from '@features/liquidity';
import { TokenInput } from '@features/mint';
import { useTokenBalance } from '@features/portfolio';
import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses } from '@shared/config/addresses';
import { useEstimateFee } from '@shared/hooks';
import { formatWad, formatWadCompact, parseWad } from '@shared/math/wad';
import { Button } from '@shared/ui/Button';
import { Card, CardContent } from '@shared/ui/Card';
import {
  FormActions,
  FormHeader,
  FormInfoSection,
  FormInputSection,
  FormLayout,
  FormRow,
} from '@shared/ui/FormLayout';
import { GasEstimate } from '@shared/ui/GasEstimate';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';
import { TxStatus } from '@widgets/display/TxStatus';

interface RemoveLiquidityFormProps {
  market: MarketData;
  className?: string;
}

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
];

const PERCENTAGE_OPTIONS = [
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: 'Max', value: 100 },
];

export function RemoveLiquidityForm({ market, className }: RemoveLiquidityFormProps): ReactNode {
  const { isConnected, address } = useAccount();
  const { network } = useStarknet();
  const [lpAmount, setLpAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50); // 0.5% default

  const addresses = getAddresses(network);
  const { removeLiquidity, isRemoving, isSuccess, isError, error, transactionHash } =
    useRemoveLiquidity();

  // Get token symbols from metadata for proper naming (I-06)
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const lpSymbol = `LP-${tokenSymbol}`;

  // Fetch LP balance (market is the LP token)
  const { data: lpBalance } = useTokenBalance(market.address);

  // Parse LP amount
  const parsedLpAmount = useMemo(() => {
    if (!lpAmount || lpAmount === '') return BigInt(0);
    try {
      return parseWad(lpAmount);
    } catch {
      return BigInt(0);
    }
  }, [lpAmount]);

  // Calculate expected outputs
  const { expectedSyOut, expectedPtOut } = useMemo(() => {
    if (parsedLpAmount === BigInt(0) || market.state.totalLpSupply === BigInt(0)) {
      return { expectedSyOut: BigInt(0), expectedPtOut: BigInt(0) };
    }

    const { syReserve, ptReserve, totalLpSupply } = market.state;

    const expectedSy = (parsedLpAmount * syReserve) / totalLpSupply;
    const expectedPt = (parsedLpAmount * ptReserve) / totalLpSupply;

    return { expectedSyOut: expectedSy, expectedPtOut: expectedPt };
  }, [parsedLpAmount, market.state]);

  // Calculate minimum outputs with slippage
  const { minSyOut, minPtOut } = useMemo(() => {
    return calculateMinOutputs(
      parsedLpAmount,
      market.state.syReserve,
      market.state.ptReserve,
      market.state.totalLpSupply,
      slippageBps
    );
  }, [parsedLpAmount, market.state, slippageBps]);

  // Build calls for gas estimation
  const removeLiquidityCalls = useMemo(() => {
    if (!address || parsedLpAmount === BigInt(0)) return null;
    try {
      return buildRemoveLiquidityCalls(addresses.router, address, {
        marketAddress: market.address,
        lpAmount: parsedLpAmount,
        minSyOut,
        minPtOut,
      });
    } catch {
      return null;
    }
  }, [address, addresses.router, market.address, parsedLpAmount, minSyOut, minPtOut]);

  // Estimate gas fee
  const {
    formattedFee,
    isLoading: isEstimatingFee,
    error: feeError,
  } = useEstimateFee(removeLiquidityCalls);

  // Calculate share of pool being removed
  const poolShareRemoved = useMemo(() => {
    if (parsedLpAmount === BigInt(0) || market.state.totalLpSupply === BigInt(0)) {
      return new BigNumber(0);
    }
    return new BigNumber(parsedLpAmount.toString())
      .dividedBy(market.state.totalLpSupply.toString())
      .multipliedBy(100);
  }, [parsedLpAmount, market.state.totalLpSupply]);

  // Validation
  const hasInsufficientBalance = lpBalance !== undefined && parsedLpAmount > lpBalance;
  const isValidAmount = parsedLpAmount > BigInt(0);

  const canRemoveLiquidity =
    isConnected && isValidAmount && !hasInsufficientBalance && !isRemoving && !isSuccess;

  // Determine transaction status
  const txStatus = useMemo(() => {
    if (isRemoving) return 'pending' as const;
    if (isSuccess) return 'success' as const;
    if (isError) return 'error' as const;
    return 'idle' as const;
  }, [isRemoving, isSuccess, isError]);

  // Handle remove liquidity
  const handleRemoveLiquidity = (): void => {
    if (!canRemoveLiquidity) return;

    removeLiquidity({
      marketAddress: market.address,
      lpAmount: parsedLpAmount,
      minSyOut,
      minPtOut,
    });
  };

  // Handle percentage buttons
  const handlePercentage = (percentage: number): void => {
    if (lpBalance !== undefined && lpBalance > BigInt(0)) {
      const amount = (lpBalance * BigInt(percentage)) / BigInt(100);
      setLpAmount(formatWad(amount, 18));
    }
  };

  // Clear input on success
  useEffect(() => {
    if (isSuccess) {
      setLpAmount('');
    }
  }, [isSuccess]);

  return (
    <FormLayout gradient="primary" className={className}>
      {/* Header */}
      <FormHeader title="Remove Liquidity" />

      {/* Input Section */}
      <FormInputSection>
        <TokenInput
          label="LP to Remove"
          tokenAddress={market.address}
          tokenSymbol={lpSymbol}
          value={lpAmount}
          onChange={setLpAmount}
          error={hasInsufficientBalance ? 'Insufficient balance' : undefined}
        />
      </FormInputSection>

      {/* Percentage Buttons */}
      <div className="flex gap-2">
        {PERCENTAGE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant="outline"
            size="sm"
            onClick={(): void => {
              handlePercentage(option.value);
            }}
            className="flex-1"
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Output Preview */}
      <Card size="sm" className="bg-muted">
        <CardContent className="p-4">
          <div className="text-muted-foreground mb-2 text-sm">You will receive</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span
                className={
                  isValidAmount
                    ? 'text-foreground text-lg font-semibold'
                    : 'text-muted-foreground text-lg font-semibold'
                }
              >
                {isValidAmount ? formatWad(expectedSyOut, 6) : '0.000000'} SY
              </span>
              <span className="text-muted-foreground text-sm">
                min: {isValidAmount ? formatWad(minSyOut, 6) : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span
                className={
                  isValidAmount
                    ? 'text-foreground text-lg font-semibold'
                    : 'text-muted-foreground text-lg font-semibold'
                }
              >
                {isValidAmount ? formatWad(expectedPtOut, 6) : '0.000000'} PT
              </span>
              <span className="text-muted-foreground text-sm">
                min: {isValidAmount ? formatWad(minPtOut, 6) : '-'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pool Info */}
      <FormInfoSection>
        <div className="space-y-2">
          <FormRow
            label="Pool Share Removed"
            value={isValidAmount ? `${poolShareRemoved.toFixed(4)}%` : '-'}
            valueClassName={isValidAmount ? 'text-foreground' : 'text-muted-foreground'}
          />
          <FormRow
            label="Current Pool Reserves"
            value={`${formatWadCompact(market.state.syReserve)} SY / ${formatWadCompact(market.state.ptReserve)} PT`}
          />
          <FormRow label="Slippage Tolerance" value={`${(slippageBps / 100).toString()}%`} />
          {isValidAmount && (
            <FormRow
              label="Estimated Gas"
              value={
                <GasEstimate
                  formattedFee={formattedFee}
                  isLoading={isEstimatingFee}
                  error={feeError}
                />
              }
            />
          )}
        </div>
      </FormInfoSection>

      {/* Slippage Settings */}
      <div>
        <div className="text-muted-foreground mb-2 text-sm">Slippage Tolerance</div>
        <ToggleGroup className="flex gap-1">
          {SLIPPAGE_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              pressed={slippageBps === option.value}
              onPressedChange={() => {
                setSlippageBps(option.value);
              }}
              variant="outline"
              size="sm"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Transaction Status */}
      {txStatus !== 'idle' && (
        <TxStatus status={txStatus} txHash={transactionHash ?? null} error={error} />
      )}

      {/* Actions */}
      <FormActions>
        <Button
          onClick={handleRemoveLiquidity}
          disabled={!canRemoveLiquidity || isRemoving}
          className="h-12 w-full text-base font-medium"
        >
          {isRemoving
            ? 'Removing Liquidity...'
            : !isConnected
              ? 'Connect Wallet'
              : !isValidAmount
                ? 'Enter Amount'
                : hasInsufficientBalance
                  ? 'Insufficient LP Balance'
                  : isSuccess
                    ? 'Liquidity Removed!'
                    : 'Remove Liquidity'}
        </Button>
      </FormActions>
    </FormLayout>
  );
}
