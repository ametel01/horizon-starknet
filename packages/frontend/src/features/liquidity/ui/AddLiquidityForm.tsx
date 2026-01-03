'use client';

import type { MarketData } from '@entities/market';
import {
  buildAddLiquidityCalls,
  calculateBalancedAmounts,
  calculateMinLpOut,
  useAddLiquidity,
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
import { Switch } from '@shared/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';
import { TxStatus } from '@widgets/display/TxStatus';
import BigNumber from 'bignumber.js';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

interface AddLiquidityFormProps {
  market: MarketData;
  className?: string;
}

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
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

function determineTxStatus(isAdding: boolean, isSuccess: boolean, isError: boolean): TxStatusValue {
  if (isAdding) return 'pending';
  if (isSuccess) return 'success';
  if (isError) return 'error';
  return 'idle';
}

interface ButtonTextParams {
  isAdding: boolean;
  isConnected: boolean;
  isValidAmount: boolean;
  hasInsufficientSyBalance: boolean;
  hasInsufficientPtBalance: boolean;
  isSuccess: boolean;
}

function getButtonText(params: ButtonTextParams): string {
  const {
    isAdding,
    isConnected,
    isValidAmount,
    hasInsufficientSyBalance,
    hasInsufficientPtBalance,
    isSuccess,
  } = params;
  if (isAdding) return 'Adding Liquidity...';
  if (!isConnected) return 'Connect Wallet';
  if (!isValidAmount) return 'Enter Amounts';
  if (hasInsufficientSyBalance) return 'Insufficient SY Balance';
  if (hasInsufficientPtBalance) return 'Insufficient PT Balance';
  if (isSuccess) return 'Liquidity Added!';
  return 'Add Liquidity';
}

interface ExpectedLpParams {
  syAmount: bigint;
  ptAmount: bigint;
  syReserve: bigint;
  ptReserve: bigint;
  totalLpSupply: bigint;
}

function calculateExpectedLp(params: ExpectedLpParams): bigint {
  const { syAmount, ptAmount, syReserve, ptReserve, totalLpSupply } = params;
  if (syAmount === BigInt(0) || ptAmount === BigInt(0)) {
    return BigInt(0);
  }

  if (totalLpSupply === BigInt(0)) {
    // Initial liquidity - use geometric mean approximation
    return syAmount < ptAmount ? syAmount : ptAmount;
  }

  // Calculate LP based on proportional contribution
  const lpFromSy = (syAmount * totalLpSupply) / syReserve;
  const lpFromPt = (ptAmount * totalLpSupply) / ptReserve;
  return lpFromSy < lpFromPt ? lpFromSy : lpFromPt;
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

// ----- Main Component -----

export function AddLiquidityForm({ market, className }: AddLiquidityFormProps): ReactNode {
  const { isConnected, address } = useAccount();
  const { network } = useStarknet();
  const [syAmount, setSyAmount] = useState('');
  const [ptAmount, setPtAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50); // 0.5% default
  const [isBalanced, setIsBalanced] = useState(true);

  const addresses = getAddresses(network);
  const { addLiquidity, isAdding, isSuccess, isError, error, transactionHash } = useAddLiquidity();

  // Get token symbols from metadata for proper naming (I-06)
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const sySymbol = `SY-${tokenSymbol}`;
  const ptSymbol = `PT-${tokenSymbol}`;

  // Fetch balances
  const { data: syBalance } = useTokenBalance(market.syAddress);
  const { data: ptBalance } = useTokenBalance(market.ptAddress);

  // Parse amounts
  const parsedSyAmount = useMemo(() => parseAmountSafe(syAmount), [syAmount]);
  const parsedPtAmount = useMemo(() => parseAmountSafe(ptAmount), [ptAmount]);

  // Calculate balanced amounts when SY changes
  useEffect(() => {
    if (isBalanced && syAmount && market.state.syReserve > BigInt(0)) {
      const { ptAmount: calculatedPt } = calculateBalancedAmounts(
        parsedSyAmount,
        true,
        market.state.syReserve,
        market.state.ptReserve
      );
      setPtAmount(formatWad(calculatedPt, 18));
    }
  }, [syAmount, isBalanced, parsedSyAmount, market.state.syReserve, market.state.ptReserve]);

  // Calculate expected LP output
  const expectedLpOut = useMemo(
    () =>
      calculateExpectedLp({
        syAmount: parsedSyAmount,
        ptAmount: parsedPtAmount,
        syReserve: market.state.syReserve,
        ptReserve: market.state.ptReserve,
        totalLpSupply: market.state.totalLpSupply,
      }),
    [parsedSyAmount, parsedPtAmount, market.state]
  );

  // Calculate minimum LP output with slippage
  const minLpOut = useMemo(() => {
    return calculateMinLpOut(
      parsedSyAmount,
      parsedPtAmount,
      market.state.syReserve,
      market.state.ptReserve,
      market.state.totalLpSupply,
      slippageBps
    );
  }, [parsedSyAmount, parsedPtAmount, market.state, slippageBps]);

  // Build calls for gas estimation
  const addLiquidityCalls = useMemo(() => {
    if (!address || parsedSyAmount === BigInt(0) || parsedPtAmount === BigInt(0)) return null;
    try {
      return buildAddLiquidityCalls(addresses.router, address, {
        marketAddress: market.address,
        syAddress: market.syAddress,
        ptAddress: market.ptAddress,
        syAmount: parsedSyAmount,
        ptAmount: parsedPtAmount,
        minLpOut,
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
    parsedSyAmount,
    parsedPtAmount,
    minLpOut,
  ]);

  // Estimate gas fee
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: isEstimatingFee,
    error: feeError,
  } = useEstimateFee(addLiquidityCalls);

  // Calculate share of pool
  const poolShare = useMemo(() => {
    if (expectedLpOut === BigInt(0)) return new BigNumber(0);
    const newTotalSupply = market.state.totalLpSupply + expectedLpOut;
    if (newTotalSupply === BigInt(0)) return new BigNumber(100);
    return new BigNumber(expectedLpOut.toString())
      .dividedBy(newTotalSupply.toString())
      .multipliedBy(100);
  }, [expectedLpOut, market.state.totalLpSupply]);

  // Validation
  const hasInsufficientSyBalance = syBalance !== undefined && parsedSyAmount > syBalance;
  const hasInsufficientPtBalance = ptBalance !== undefined && parsedPtAmount > ptBalance;
  const isValidAmount = parsedSyAmount > BigInt(0) && parsedPtAmount > BigInt(0);

  const canAddLiquidity =
    isConnected &&
    isValidAmount &&
    !hasInsufficientSyBalance &&
    !hasInsufficientPtBalance &&
    !isAdding &&
    !isSuccess;

  // Determine transaction status
  const txStatus = useMemo(
    () => determineTxStatus(isAdding, isSuccess, isError),
    [isAdding, isSuccess, isError]
  );

  // Transaction steps for StepProgress
  const transactionSteps: Step[] = useMemo(() => {
    return [
      { label: 'Approve SY', description: `Approve ${sySymbol} spending` },
      { label: 'Approve PT', description: `Approve ${ptSymbol} spending` },
      { label: 'Add Liquidity', description: 'Deposit tokens to pool' },
    ];
  }, [sySymbol, ptSymbol]);

  // Calculate current step based on transaction state
  // Starknet multicall executes all steps atomically, so we show:
  // - idle: -1 (no steps active)
  // - pending: 2 (all steps in progress, showing final step as active)
  // - success: 3 (all complete)
  // - error: stays at last attempted step
  const currentStep = useMemo(() => {
    if (isSuccess) return transactionSteps.length; // All complete
    if (isAdding) return transactionSteps.length - 1; // Show last step as active during tx
    return -1; // No transaction in progress
  }, [isAdding, isSuccess, transactionSteps.length]);

  // Handle add liquidity
  const handleAddLiquidity = (): void => {
    if (!canAddLiquidity) return;

    addLiquidity({
      marketAddress: market.address,
      syAddress: market.syAddress,
      ptAddress: market.ptAddress,
      syAmount: parsedSyAmount,
      ptAmount: parsedPtAmount,
      minLpOut,
    });
  };

  // Clear inputs on success
  useEffect(() => {
    if (isSuccess) {
      setSyAmount('');
      setPtAmount('');
    }
  }, [isSuccess]);

  // Handle balanced mode toggle with confirmation feedback
  const handleBalancedChange = useCallback((checked: boolean): void => {
    setIsBalanced(checked);
    toast.success(checked ? 'Balanced deposit enabled' : 'Custom amounts enabled', {
      description: checked
        ? 'PT amount will auto-calculate based on pool ratio'
        : 'You can now set custom SY and PT amounts',
      duration: 2000,
    });
  }, []);

  return (
    <FormLayout gradient="primary" className={className}>
      {/* Header */}
      <FormHeader title="Add Liquidity" />

      {/* Balanced Mode Toggle */}
      <div className="flex items-center gap-2">
        <Switch checked={isBalanced} onCheckedChange={handleBalancedChange} />
        <span className="text-muted-foreground text-sm">Balanced deposit</span>
      </div>

      {/* Input Section */}
      <FormInputSection>
        <TokenInput
          label="SY Amount"
          tokenAddress={market.syAddress}
          tokenSymbol={sySymbol}
          value={syAmount}
          onChange={setSyAmount}
          error={hasInsufficientSyBalance ? 'Insufficient balance' : undefined}
        />
        <TokenInput
          label="PT Amount"
          tokenAddress={market.ptAddress}
          tokenSymbol={ptSymbol}
          value={ptAmount}
          onChange={(value): void => {
            if (!isBalanced) {
              setPtAmount(value);
            }
          }}
          disabled={isBalanced}
          error={hasInsufficientPtBalance ? 'Insufficient balance' : undefined}
        />
      </FormInputSection>

      {/* Output Preview */}
      <Card size="sm" className="bg-muted">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Expected LP Tokens</span>
            <span className="text-muted-foreground text-sm">
              Min: {isValidAmount ? formatWad(minLpOut, 6) : '-'} LP
            </span>
          </div>
          <div className="text-foreground mt-2 text-2xl font-semibold">
            {isValidAmount ? formatWad(expectedLpOut, 6) : '0.000000'} LP
          </div>
        </CardContent>
      </Card>

      {/* Pool Info */}
      <FormInfoSection>
        <div className="space-y-2">
          <FormRow
            label="Share of Pool"
            value={isValidAmount ? `${poolShare.toFixed(4)}%` : '-'}
            valueClassName={isValidAmount ? 'text-foreground' : 'text-muted-foreground'}
          />
          <FormRow
            label="Pool Reserves"
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
          onClick={handleAddLiquidity}
          disabled={!canAddLiquidity || isAdding}
          variant="form-primary"
        >
          {getButtonText({
            isAdding,
            isConnected,
            isValidAmount,
            hasInsufficientSyBalance,
            hasInsufficientPtBalance,
            isSuccess,
          })}
        </Button>
      </FormActions>
    </FormLayout>
  );
}
