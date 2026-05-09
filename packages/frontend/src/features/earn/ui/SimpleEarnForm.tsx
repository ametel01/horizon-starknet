'use client';

import type { MarketData } from '@entities/market';
import { useSimpleDeposit } from '@features/earn';
import { TokenInput } from '@features/mint';
import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses } from '@shared/config/addresses';
import { useEstimateFee } from '@shared/hooks';
import { formatWad, toWad } from '@shared/math/wad';
import { formatExpiry } from '@shared/math/yield';
import { buildDepositAndEarnCalls } from '@shared/starknet';
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
import { TxStatus } from '@widgets/display/TxStatus';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

interface SimpleEarnFormProps {
  market: MarketData;
  className?: string;
}

/**
 * Simplified earning form for simple mode.
 * Combines deposit + split into a single "Deposit & Earn" action.
 * Hides SY/PT/YT terminology and focuses on the user's deposit amount and expected returns.
 */
export function SimpleEarnForm({ market, className }: SimpleEarnFormProps): ReactNode {
  const { isConnected, address } = useAccount();
  const { network } = useStarknet();
  const [amount, setAmount] = useState('');

  const underlyingAddress = market.metadata?.underlyingAddress ?? '';
  const addresses = getAddresses(network);

  const {
    underlyingBalance,
    underlyingAllowance,
    syAllowance,
    deposit,
    status,
    txHash,
    error,
    isLoading,
    reset,
  } = useSimpleDeposit({
    underlyingAddress,
    syAddress: market.syAddress,
    ytAddress: market.ytAddress,
  });

  // Calculate output amounts (1:1 ratio for PT and YT from underlying)
  const outputAmount = useMemo(() => {
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

    try {
      const amountWad = toWad(amount);

      if (underlyingBalance !== undefined && amountWad > underlyingBalance) {
        return 'Insufficient balance';
      }
    } catch {
      return 'Invalid amount';
    }

    return null;
  }, [amount, underlyingBalance]);

  // Build calls for gas estimation
  const depositCalls = useMemo(() => {
    if (!address || !amount || amount === '0' || validationError || !underlyingAddress) return null;
    try {
      const amountWad = toWad(amount);
      return buildDepositAndEarnCalls({
        userAddress: address,
        underlyingAddress,
        syAddress: market.syAddress,
        ytAddress: market.ytAddress,
        routerAddress: addresses.router,
        amount: amountWad,
        underlyingAllowance,
        syAllowance,
      });
    } catch {
      return null;
    }
  }, [
    address,
    amount,
    validationError,
    underlyingAddress,
    market.syAddress,
    market.ytAddress,
    addresses.router,
    underlyingAllowance,
    syAllowance,
  ]);

  // Estimate gas fee
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: isEstimatingFee,
    error: feeError,
  } = useEstimateFee(depositCalls);

  // Handle deposit
  const handleDeposit = useCallback(async () => {
    if (validationError || !underlyingAddress) return;
    await deposit(amount);
  }, [amount, deposit, validationError, underlyingAddress]);

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
    !underlyingAddress;

  const buttonText = useMemo(() => {
    if (!isConnected) return 'Connect Wallet';
    if (!underlyingAddress) return 'Token not supported';
    if (isLoading) return 'Processing...';
    if (validationError) return validationError;
    if (!amount || amount === '0') return 'Enter Amount';
    return 'Deposit & Earn';
  }, [isConnected, underlyingAddress, isLoading, validationError, amount]);

  // Get display values
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const tokenName = market.metadata?.yieldTokenName ?? 'tokens';
  const fixedApy = market.impliedApy.toNumber() * 100;
  const maturityDate = formatExpiry(market.expiry);

  return (
    <FormLayout gradient="primary" className={className}>
      {/* Header */}
      <FormHeader
        title="Earn Fixed Yield"
        description={`Deposit your ${tokenName} to earn a guaranteed fixed rate`}
      />

      {/* Input Section */}
      <FormInputSection>
        <TokenInput
          label="You deposit"
          tokenAddress={underlyingAddress}
          tokenSymbol={tokenSymbol}
          value={amount}
          onChange={setAmount}
          disabled={isLoading || !underlyingAddress}
          error={validationError ?? undefined}
        />
      </FormInputSection>

      {/* Divider */}
      <FormDivider>
        <div className="bg-muted rounded-full p-2">
          <svg
            className="text-muted-foreground size-4"
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
            <span className="text-muted-foreground text-sm">You&apos;ll receive</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Fixed-Rate Position</span>
              <span className="text-foreground font-mono">{formatWad(outputAmount, 4)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Variable-Rate Position</span>
              <span className="text-foreground font-mono">{formatWad(outputAmount, 4)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Yield Info */}
      <Card size="sm" className="border-primary/30 bg-primary/5 border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-primary text-sm font-medium">Fixed Rate</div>
              <div className="text-primary text-2xl font-bold">{fixedApy.toFixed(2)}%</div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground text-sm">Matures on</div>
              <div className="text-foreground font-medium">{maturityDate}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simple Info */}
      <div className="text-muted-foreground space-y-1 text-xs">
        <p>
          Your deposit will be split into two positions. The Fixed-Rate Position earns the
          guaranteed rate shown above. The Variable-Rate Position earns floating yield until
          maturity.
        </p>
      </div>

      {/* Gas Estimate */}
      {outputAmount > BigInt(0) && (
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
            Deposit More
          </Button>
        ) : (
          <Button
            onClick={handleDeposit}
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
