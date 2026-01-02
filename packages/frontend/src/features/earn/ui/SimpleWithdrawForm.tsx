'use client';

import type { MarketData } from '@entities/market';
import { useSimpleWithdraw } from '@features/earn';
import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses } from '@shared/config/addresses';
import { useEstimateFee } from '@shared/hooks';
import { formatWad, fromWad, toWad } from '@shared/math/wad';
import { formatExpiry } from '@shared/math/yield';
import { buildWithdrawCalls } from '@shared/starknet';
import { Button } from '@shared/ui/Button';
import { Card, CardContent } from '@shared/ui/Card';
import {
  FormActions,
  FormDivider,
  FormHeader,
  FormInputSection,
  FormLayout,
} from '@shared/ui/FormLayout';
import { GasEstimate } from '@shared/ui/GasEstimate';
import { NumberInput } from '@shared/ui/Input';
import { Skeleton } from '@shared/ui/Skeleton';
import { TxStatus } from '@widgets/display/TxStatus';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

interface SimpleWithdrawFormProps {
  market: MarketData;
  className?: string;
}

/**
 * Simplified withdraw form for simple mode.
 * Combines redeem + unwrap into a single "Withdraw" action.
 * Pre-expiry: Requires equal PT and YT amounts
 * Post-expiry: Only requires PT
 */
export function SimpleWithdrawForm({ market, className }: SimpleWithdrawFormProps): ReactNode {
  const { isConnected, address } = useAccount();
  const { network } = useStarknet();
  const [amount, setAmount] = useState('');

  const underlyingAddress = market.metadata?.underlyingAddress ?? '';
  const addresses = getAddresses(network);

  const {
    ptBalance,
    ytBalance,
    balancesLoading,
    ptAllowance,
    ytAllowance,
    withdraw,
    status,
    txHash,
    error,
    isLoading,
    reset,
  } = useSimpleWithdraw({
    underlyingAddress,
    syAddress: market.syAddress,
    ptAddress: market.ptAddress,
    ytAddress: market.ytAddress,
    isExpired: market.isExpired,
  });

  // Calculate max withdrawable amount
  // Pre-expiry: min(PT, YT) - need equal amounts
  // Post-expiry: PT balance only
  const maxWithdrawable = useMemo(() => {
    if (ptBalance === undefined) return BigInt(0);
    if (market.isExpired) {
      return ptBalance;
    }
    if (ytBalance === undefined) return BigInt(0);
    return ptBalance < ytBalance ? ptBalance : ytBalance;
  }, [ptBalance, ytBalance, market.isExpired]);

  // Convert amount to bigint
  const amountWad = useMemo(() => {
    if (!amount || amount === '0') {
      return BigInt(0);
    }
    try {
      return toWad(amount);
    } catch {
      return BigInt(0);
    }
  }, [amount]);

  // Validate input
  const validationError = useMemo(() => {
    if (!amount || amount === '0') {
      return null;
    }

    if (amountWad > maxWithdrawable) {
      if (!market.isExpired && ptBalance !== undefined && ytBalance !== undefined) {
        if (ptBalance < ytBalance) {
          return 'Exceeds Fixed-Rate Position balance';
        } else {
          return 'Exceeds Variable-Rate Position balance';
        }
      }
      return 'Insufficient balance';
    }

    return null;
  }, [amount, amountWad, maxWithdrawable, market.isExpired, ptBalance, ytBalance]);

  // Build calls for gas estimation
  const withdrawCalls = useMemo(() => {
    if (!address || amountWad === BigInt(0) || validationError || !underlyingAddress) return null;
    try {
      return buildWithdrawCalls({
        userAddress: address,
        underlyingAddress,
        syAddress: market.syAddress,
        ptAddress: market.ptAddress,
        ytAddress: market.ytAddress,
        routerAddress: addresses.router,
        amount: amountWad,
        isExpired: market.isExpired,
        ptAllowance,
        ytAllowance,
      });
    } catch {
      return null;
    }
  }, [
    address,
    amountWad,
    validationError,
    underlyingAddress,
    market.syAddress,
    market.ptAddress,
    market.ytAddress,
    market.isExpired,
    addresses.router,
    ptAllowance,
    ytAllowance,
  ]);

  // Estimate gas fee
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: isEstimatingFee,
    error: feeError,
  } = useEstimateFee(withdrawCalls);

  // Handle withdraw
  const handleWithdraw = useCallback(async () => {
    if (validationError || amountWad === BigInt(0)) return;
    await withdraw(amountWad);
  }, [amountWad, withdraw, validationError]);

  // Handle max button
  const handleMax = useCallback(() => {
    if (maxWithdrawable > BigInt(0)) {
      setAmount(fromWad(maxWithdrawable).toString());
    }
  }, [maxWithdrawable]);

  // Clear input on success
  useEffect(() => {
    if (status === 'success') {
      setAmount('');
    }
  }, [status]);

  // Handle reset after success
  const handleReset = useCallback(() => {
    setAmount('');
    reset();
  }, [reset]);

  // Button state
  const buttonDisabled =
    !isConnected ||
    !amount ||
    amount === '0' ||
    !!validationError ||
    isLoading ||
    maxWithdrawable === BigInt(0);

  const buttonText = useMemo(() => {
    if (!isConnected) return 'Connect Wallet';
    if (isLoading) return 'Processing...';
    if (validationError) return validationError;
    if (maxWithdrawable === BigInt(0)) return 'No Position to Withdraw';
    if (!amount || amount === '0') return 'Enter Amount';
    return 'Withdraw';
  }, [isConnected, isLoading, validationError, maxWithdrawable, amount]);

  // Get display values
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const maturityDate = formatExpiry(market.expiry);

  return (
    <FormLayout gradient="primary" className={className}>
      {/* Header */}
      <FormHeader
        title="Withdraw"
        description={
          market.isExpired
            ? 'Redeem your matured position back to tokens'
            : 'Withdraw your position before maturity'
        }
      />

      <FormInputSection>
        {/* Balance Display */}
        <Card size="sm" className="bg-muted">
          <CardContent className="p-4">
            <div className="mb-3">
              <span className="text-muted-foreground text-sm">Your Position</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Fixed-Rate Position</span>
                {balancesLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : (
                  <span className="text-foreground font-mono">
                    {formatWad(ptBalance ?? BigInt(0), 4)}
                  </span>
                )}
              </div>
              {!market.isExpired && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Variable-Rate Position</span>
                  {balancesLoading ? (
                    <Skeleton className="h-5 w-20" />
                  ) : (
                    <span className="text-foreground font-mono">
                      {formatWad(ytBalance ?? BigInt(0), 4)}
                    </span>
                  )}
                </div>
              )}
              <div className="border-border border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-sm font-medium">Available to Withdraw</span>
                  {balancesLoading ? (
                    <Skeleton className="h-5 w-20" />
                  ) : (
                    <span className="text-foreground font-mono font-medium">
                      {formatWad(maxWithdrawable, 4)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Amount Input */}
        <Card size="sm" className="bg-muted">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Amount to Withdraw</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleMax}
                disabled={isLoading || maxWithdrawable === BigInt(0)}
              >
                MAX
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <NumberInput
                value={amount}
                onChange={setAmount}
                placeholder="0.0"
                disabled={isLoading}
                className="border-0 bg-transparent text-2xl focus-visible:ring-0"
              />
              <span className="text-foreground min-w-[60px] text-right font-medium">
                {tokenSymbol}
              </span>
            </div>
            {validationError && <p className="text-destructive mt-2 text-sm">{validationError}</p>}
          </CardContent>
        </Card>
      </FormInputSection>

      {/* Divider */}
      <FormDivider>
        <div className="bg-muted rounded-full p-2">
          <svg
            className="text-muted-foreground h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </FormDivider>

      {/* Output Preview */}
      <Card size="sm" className="bg-muted">
        <CardContent className="p-4">
          <div className="mb-2">
            <span className="text-muted-foreground text-sm">You&apos;ll receive (estimated)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground font-mono text-2xl">~{formatWad(amountWad, 4)}</span>
            <span className="text-foreground font-medium">{tokenSymbol}</span>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            {market.isExpired
              ? 'Actual amount may vary slightly based on the redemption rate at maturity.'
              : 'Based on 1:1 redemption. Actual amount depends on current exchange rate.'}
          </p>
        </CardContent>
      </Card>

      {/* Info */}
      {!market.isExpired && (
        <div className="text-muted-foreground space-y-1 text-xs">
          <p>
            Withdrawing before maturity ({maturityDate}) requires equal amounts of both positions.
            After maturity, you can withdraw your Fixed-Rate Position directly.
          </p>
        </div>
      )}

      {market.isExpired && (
        <div className="border-primary/30 bg-primary/5 rounded-lg border p-3">
          <p className="text-primary text-sm">
            Your position has matured. You can now withdraw your full Fixed-Rate Position.
          </p>
        </div>
      )}

      {/* Gas Estimate */}
      {amountWad > BigInt(0) && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estimated Gas</span>
          <GasEstimate
            formattedFee={formattedFee}
            formattedFeeUsd={formattedFeeUsd}
            isLoading={isEstimatingFee}
            error={feeError}
          />
        </div>
      )}

      {/* Transaction Status */}
      {status !== 'idle' && (
        <TxStatus
          status={status}
          txHash={txHash}
          error={error}
          gasEstimate={{
            formattedFee,
            formattedFeeUsd,
            isLoading: isEstimatingFee,
            error: feeError,
          }}
        />
      )}

      {/* Actions */}
      <FormActions>
        {status === 'success' ? (
          <Button onClick={handleReset} className="h-12 w-full text-base font-medium">
            Withdraw More
          </Button>
        ) : (
          <Button
            onClick={handleWithdraw}
            disabled={buttonDisabled}
            className="h-12 w-full text-base font-medium"
          >
            {buttonText}
          </Button>
        )}
      </FormActions>
    </FormLayout>
  );
}
