'use client';

import type { MarketData } from '@entities/market';
import {
  buildRemoveLiquidityCalls,
  buildRemoveLiquiditySinglePtCalls,
  buildRemoveLiquiditySingleSyCalls,
  calculateMinOutputs,
  useRemoveLiquidity,
  useRemoveLiquidityPreview,
  useRemoveLiquiditySinglePt,
  useRemoveLiquiditySingleSy,
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
import { type Step, StepProgress } from '@shared/ui/StepProgress';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';
import { TxStatus } from '@widgets/display/TxStatus';
import BigNumber from 'bignumber.js';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

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

type OutputType = 'dual' | 'sy-only' | 'pt-only';

const OUTPUT_TYPE_OPTIONS = [
  { label: 'SY + PT', value: 'dual' as const },
  { label: 'SY Only', value: 'sy-only' as const },
  { label: 'PT Only', value: 'pt-only' as const },
];

// ----- Helper Functions -----

function parseAmountSafe(amount: string): bigint {
  if (!amount || amount === '') return BigInt(0);
  try {
    return parseWad(amount);
  } catch {
    return BigInt(0);
  }
}

type TxStatusValue = 'idle' | 'pending' | 'success' | 'error';

function determineTxStatus(
  isRemoving: boolean,
  isSuccess: boolean,
  isError: boolean
): TxStatusValue {
  if (isRemoving) return 'pending';
  if (isSuccess) return 'success';
  if (isError) return 'error';
  return 'idle';
}

interface ButtonTextParams {
  isRemoving: boolean;
  isConnected: boolean;
  isValidAmount: boolean;
  hasInsufficientBalance: boolean;
  isSuccess: boolean;
  outputType: OutputType;
  isPreviewLoading: boolean;
}

function getButtonText(params: ButtonTextParams): string {
  const {
    isRemoving,
    isConnected,
    isValidAmount,
    hasInsufficientBalance,
    isSuccess,
    outputType,
    isPreviewLoading,
  } = params;
  if (isRemoving) return 'Removing Liquidity...';
  if (!isConnected) return 'Connect Wallet';
  if (!isValidAmount) return 'Enter Amount';
  if (hasInsufficientBalance) return 'Insufficient LP Balance';
  if (isSuccess) return 'Liquidity Removed!';
  if (isPreviewLoading) return 'Loading Preview...';
  if (outputType === 'sy-only') return 'Remove to SY';
  if (outputType === 'pt-only') return 'Remove to PT';
  return 'Remove Liquidity';
}

interface ExpectedOutputsParams {
  lpAmount: bigint;
  syReserve: bigint;
  ptReserve: bigint;
  totalLpSupply: bigint;
}

function calculateExpectedOutputs(params: ExpectedOutputsParams): {
  expectedSyOut: bigint;
  expectedPtOut: bigint;
} {
  const { lpAmount, syReserve, ptReserve, totalLpSupply } = params;
  if (lpAmount === BigInt(0) || totalLpSupply === BigInt(0)) {
    return { expectedSyOut: BigInt(0), expectedPtOut: BigInt(0) };
  }
  return {
    expectedSyOut: (lpAmount * syReserve) / totalLpSupply,
    expectedPtOut: (lpAmount * ptReserve) / totalLpSupply,
  };
}

/**
 * Calculate expected PT output for single-sided PT removal.
 * This is an approximation based on the LP share of PT reserves.
 * The actual swap-based calculation would require on-chain preview.
 */
function calculateExpectedPtOnlyOutput(params: ExpectedOutputsParams): bigint {
  const { lpAmount, syReserve, ptReserve, totalLpSupply } = params;
  if (lpAmount === BigInt(0) || totalLpSupply === BigInt(0)) {
    return BigInt(0);
  }
  // Pro-rata share of reserves
  const syShare = (lpAmount * syReserve) / totalLpSupply;
  const ptShare = (lpAmount * ptReserve) / totalLpSupply;

  // Approximate: SY gets swapped to PT, assume ~1:1 rate pre-expiry with some slippage
  // This is a rough estimate - actual value comes from swap math
  const syToPtEstimate = syShare; // Simplified approximation
  return ptShare + syToPtEstimate;
}

// ----- Sub-components -----

interface GasEstimateRowProps {
  isValidAmount: boolean;
  formattedFee: string | null;
  formattedFeeUsd: string | null;
  isLoading: boolean;
  error: Error | null;
}

function GasEstimateRow({
  isValidAmount,
  formattedFee,
  formattedFeeUsd,
  isLoading,
  error,
}: GasEstimateRowProps): ReactNode {
  if (!isValidAmount) return null;
  return (
    <FormRow
      label="Estimated Gas"
      value={
        <GasEstimate
          formattedFee={formattedFee ?? ''}
          formattedFeeUsd={formattedFeeUsd ?? undefined}
          isLoading={isLoading}
          error={error}
        />
      }
    />
  );
}

interface TransactionProgressProps {
  txStatus: TxStatusValue;
  steps: Step[];
  currentStep: number;
  txHash: string | null;
  error: Error | null;
  gasEstimate: {
    formattedFee: string | null;
    formattedFeeUsd: string | null;
    isLoading: boolean;
    error: Error | null;
  };
}

function TransactionProgress({
  txStatus,
  steps,
  currentStep,
  txHash,
  error,
  gasEstimate,
}: TransactionProgressProps): ReactNode {
  if (txStatus === 'idle') return null;

  const normalizedGasEstimate: {
    formattedFee: string;
    formattedFeeUsd?: string;
    isLoading: boolean;
    error: Error | null;
  } = {
    formattedFee: gasEstimate.formattedFee ?? '',
    isLoading: gasEstimate.isLoading,
    error: gasEstimate.error,
  };
  if (gasEstimate.formattedFeeUsd !== null) {
    normalizedGasEstimate.formattedFeeUsd = gasEstimate.formattedFeeUsd;
  }

  return (
    <div className="space-y-4">
      <StepProgress steps={steps} currentStep={currentStep} />
      <TxStatus
        status={txStatus}
        txHash={txHash}
        error={error}
        gasEstimate={normalizedGasEstimate}
      />
    </div>
  );
}

interface OutputPreviewRowProps {
  label: string;
  value: bigint;
  minValue: bigint;
  isValid: boolean;
}

function OutputPreviewRow({ label, value, minValue, isValid }: OutputPreviewRowProps): ReactNode {
  const valueClass = isValid
    ? 'text-foreground text-lg font-semibold'
    : 'text-muted-foreground text-lg font-semibold';

  return (
    <div className="flex items-center justify-between">
      <span className={valueClass}>
        {isValid ? formatWad(value, 6) : '0.000000'} {label}
      </span>
      <span className="text-muted-foreground text-sm">
        min: {isValid ? formatWad(minValue, 6) : '-'}
      </span>
    </div>
  );
}

// ----- Main Component -----

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Multi-mode removal form with dual/SY-only/PT-only outputs and on-chain preview - inherent UI complexity
export function RemoveLiquidityForm({ market, className }: RemoveLiquidityFormProps): ReactNode {
  const { isConnected, address } = useAccount();
  const { network } = useStarknet();
  const [lpAmount, setLpAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50); // 0.5% default
  const [outputType, setOutputType] = useState<OutputType>('dual');

  const addresses = getAddresses(network);

  // Dual removal hook (SY + PT)
  const {
    removeLiquidity,
    isRemoving: isRemovingDual,
    isSuccess: isSuccessDual,
    isError: isErrorDual,
    error: errorDual,
    transactionHash: txHashDual,
  } = useRemoveLiquidity();

  // Single-sided SY removal hook
  const {
    removeLiquiditySingleSy,
    isRemoving: isRemovingSy,
    isSuccess: isSuccessSy,
    isError: isErrorSy,
    error: errorSy,
    transactionHash: txHashSy,
  } = useRemoveLiquiditySingleSy();

  // Single-sided PT removal hook
  const {
    removeLiquiditySinglePt,
    isRemoving: isRemovingPt,
    isSuccess: isSuccessPt,
    isError: isErrorPt,
    error: errorPt,
    transactionHash: txHashPt,
  } = useRemoveLiquiditySinglePt();

  // Combine states based on output type
  const isRemoving =
    outputType === 'dual' ? isRemovingDual : outputType === 'sy-only' ? isRemovingSy : isRemovingPt;
  const isSuccess =
    outputType === 'dual' ? isSuccessDual : outputType === 'sy-only' ? isSuccessSy : isSuccessPt;
  const isError =
    outputType === 'dual' ? isErrorDual : outputType === 'sy-only' ? isErrorSy : isErrorPt;
  const error = outputType === 'dual' ? errorDual : outputType === 'sy-only' ? errorSy : errorPt;
  const transactionHash =
    outputType === 'dual' ? txHashDual : outputType === 'sy-only' ? txHashSy : txHashPt;

  // Get token symbols from metadata for proper naming (I-06)
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const lpSymbol = `LP-${tokenSymbol}`;

  // Fetch LP balance (market is the LP token)
  const { data: lpBalance } = useTokenBalance(market.address);

  // Parse LP amount
  const parsedLpAmount = useMemo(() => parseAmountSafe(lpAmount), [lpAmount]);

  // Preview SY-only removal using on-chain calculation
  const { data: syOnlyPreview, isLoading: isSyPreviewLoading } = useRemoveLiquidityPreview(
    market.address,
    outputType === 'sy-only' ? parsedLpAmount : undefined,
    { enabled: outputType === 'sy-only' && parsedLpAmount > 0n }
  );

  // Calculate expected outputs for dual removal
  const { expectedSyOut: dualSyOut, expectedPtOut: dualPtOut } = useMemo(
    () =>
      calculateExpectedOutputs({
        lpAmount: parsedLpAmount,
        syReserve: market.state.syReserve,
        ptReserve: market.state.ptReserve,
        totalLpSupply: market.state.totalLpSupply,
      }),
    [parsedLpAmount, market.state]
  );

  // Calculate expected PT output for PT-only removal (approximation)
  const expectedPtOnlyOut = useMemo(
    () =>
      calculateExpectedPtOnlyOutput({
        lpAmount: parsedLpAmount,
        syReserve: market.state.syReserve,
        ptReserve: market.state.ptReserve,
        totalLpSupply: market.state.totalLpSupply,
      }),
    [parsedLpAmount, market.state]
  );

  // Calculate minimum outputs with slippage
  const { minSyOut: dualMinSyOut, minPtOut: dualMinPtOut } = useMemo(() => {
    return calculateMinOutputs(
      parsedLpAmount,
      market.state.syReserve,
      market.state.ptReserve,
      market.state.totalLpSupply,
      slippageBps
    );
  }, [parsedLpAmount, market.state, slippageBps]);

  // Calculate single-sided minimum outputs with slippage
  const minSyOnlyOut = useMemo(() => {
    if (!syOnlyPreview?.expectedSyOut) return 0n;
    return (syOnlyPreview.expectedSyOut * BigInt(10000 - slippageBps)) / BigInt(10000);
  }, [syOnlyPreview?.expectedSyOut, slippageBps]);

  const minPtOnlyOut = useMemo(() => {
    if (expectedPtOnlyOut === 0n) return 0n;
    return (expectedPtOnlyOut * BigInt(10000 - slippageBps)) / BigInt(10000);
  }, [expectedPtOnlyOut, slippageBps]);

  // Build calls for gas estimation based on output type
  const removeLiquidityCalls = useMemo(() => {
    if (!address || parsedLpAmount === BigInt(0)) return null;
    try {
      if (outputType === 'sy-only') {
        return buildRemoveLiquiditySingleSyCalls(addresses.router, address, {
          marketAddress: market.address,
          syAddress: market.syAddress,
          lpAmount: parsedLpAmount,
          minSyOut: minSyOnlyOut,
        });
      }
      if (outputType === 'pt-only') {
        return buildRemoveLiquiditySinglePtCalls(addresses.router, address, {
          marketAddress: market.address,
          ptAddress: market.ptAddress,
          lpAmount: parsedLpAmount,
          minPtOut: minPtOnlyOut,
        });
      }
      return buildRemoveLiquidityCalls(addresses.router, address, {
        marketAddress: market.address,
        syAddress: market.syAddress,
        ptAddress: market.ptAddress,
        lpAmount: parsedLpAmount,
        minSyOut: dualMinSyOut,
        minPtOut: dualMinPtOut,
      });
    } catch {
      return null;
    }
  }, [
    address,
    addresses.router,
    market.address,
    market.syAddress,
    market.ptAddress,
    parsedLpAmount,
    outputType,
    minSyOnlyOut,
    minPtOnlyOut,
    dualMinSyOut,
    dualMinPtOut,
  ]);

  // Estimate gas fee
  const {
    formattedFee,
    formattedFeeUsd,
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
  // For SY-only mode, require the preview to be loaded to ensure proper slippage protection
  const isPreviewReady = outputType !== 'sy-only' || syOnlyPreview?.expectedSyOut !== undefined;

  const canRemoveLiquidity =
    isConnected &&
    isValidAmount &&
    !hasInsufficientBalance &&
    !isRemoving &&
    !isSuccess &&
    isPreviewReady;

  // Determine transaction status
  const txStatus = useMemo(
    () => determineTxStatus(isRemoving, isSuccess, isError),
    [isRemoving, isSuccess, isError]
  );

  // Transaction steps for StepProgress
  const transactionSteps: Step[] = useMemo(() => {
    return [
      { label: 'Approve LP', description: `Approve ${lpSymbol} spending` },
      { label: 'Remove Liquidity', description: 'Withdraw tokens from pool' },
    ];
  }, [lpSymbol]);

  // Calculate current step based on transaction state
  const currentStep = useMemo(() => {
    if (isSuccess) return transactionSteps.length; // All complete
    if (isRemoving) return transactionSteps.length - 1; // Show last step as active during tx
    return -1; // No transaction in progress
  }, [isRemoving, isSuccess, transactionSteps.length]);

  // Handle remove liquidity based on output type
  const handleRemoveLiquidity = (): void => {
    if (!canRemoveLiquidity) return;

    if (outputType === 'sy-only') {
      removeLiquiditySingleSy({
        marketAddress: market.address,
        syAddress: market.syAddress,
        lpAmount: parsedLpAmount,
        minSyOut: minSyOnlyOut,
      });
    } else if (outputType === 'pt-only') {
      removeLiquiditySinglePt({
        marketAddress: market.address,
        ptAddress: market.ptAddress,
        lpAmount: parsedLpAmount,
        minPtOut: minPtOnlyOut,
      });
    } else {
      removeLiquidity({
        marketAddress: market.address,
        syAddress: market.syAddress,
        ptAddress: market.ptAddress,
        lpAmount: parsedLpAmount,
        minSyOut: dualMinSyOut,
        minPtOut: dualMinPtOut,
      });
    }
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

      {/* Output Type Selector */}
      <div>
        <div className="text-muted-foreground mb-2 text-sm">Receive as</div>
        <ToggleGroup className="flex gap-1">
          {OUTPUT_TYPE_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              pressed={outputType === option.value}
              onPressedChange={() => {
                setOutputType(option.value);
              }}
              variant="outline"
              size="sm"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Output Preview */}
      <Card size="sm" className="bg-muted">
        <CardContent className="p-4">
          <div className="text-muted-foreground mb-2 text-sm">You will receive</div>
          <div className="space-y-2">
            {outputType === 'dual' && (
              <>
                <OutputPreviewRow
                  label="SY"
                  value={dualSyOut}
                  minValue={dualMinSyOut}
                  isValid={isValidAmount}
                />
                <OutputPreviewRow
                  label="PT"
                  value={dualPtOut}
                  minValue={dualMinPtOut}
                  isValid={isValidAmount}
                />
              </>
            )}
            {outputType === 'sy-only' &&
              (isSyPreviewLoading && isValidAmount ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-lg font-semibold">
                    Loading preview...
                  </span>
                </div>
              ) : (
                <OutputPreviewRow
                  label="SY"
                  value={syOnlyPreview?.expectedSyOut ?? 0n}
                  minValue={minSyOnlyOut}
                  isValid={isValidAmount}
                />
              ))}
            {outputType === 'pt-only' && (
              <OutputPreviewRow
                label="PT"
                value={expectedPtOnlyOut}
                minValue={minPtOnlyOut}
                isValid={isValidAmount}
              />
            )}
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
          <GasEstimateRow
            isValidAmount={isValidAmount}
            formattedFee={formattedFee}
            formattedFeeUsd={formattedFeeUsd}
            isLoading={isEstimatingFee}
            error={feeError}
          />
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

      {/* Transaction Progress */}
      <TransactionProgress
        txStatus={txStatus}
        steps={transactionSteps}
        currentStep={currentStep}
        txHash={transactionHash ?? null}
        error={error}
        gasEstimate={{
          formattedFee,
          formattedFeeUsd,
          isLoading: isEstimatingFee,
          error: feeError,
        }}
      />

      {/* Actions */}
      <FormActions>
        <Button
          onClick={handleRemoveLiquidity}
          disabled={!canRemoveLiquidity || isRemoving}
          variant="form-primary"
        >
          {getButtonText({
            isRemoving,
            isConnected,
            isValidAmount,
            hasInsufficientBalance,
            isSuccess,
            outputType,
            isPreviewLoading: outputType === 'sy-only' && isSyPreviewLoading && isValidAmount,
          })}
        </Button>
      </FormActions>
    </FormLayout>
  );
}
