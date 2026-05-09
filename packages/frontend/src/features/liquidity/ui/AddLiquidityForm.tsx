'use client';

import type { MarketData } from '@entities/market';
import {
  buildAddLiquidityCalls,
  buildAddLiquiditySingleSyCalls,
  calculateBalancedAmounts,
  calculateMinLpOut,
  useAddLiquidity,
  useAddLiquidityPreview,
  useAddLiquiditySingleSy,
} from '@features/liquidity';
import { TokenInput } from '@features/mint';
import { useTokenBalance } from '@features/portfolio';
import { SLIPPAGE_OPTIONS } from '@features/tx-settings';
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
import { type ReactNode, useCallback, useMemo, useReducer } from 'react';
import { toast } from 'sonner';

interface AddLiquidityFormProps {
  market: MarketData;
  className?: string;
}

type InputType = 'dual' | 'sy-only';

interface AddLiquidityFormState {
  syAmount: string;
  ptAmount: string;
  slippageBps: number;
  isBalanced: boolean;
  inputType: InputType;
}

const INITIAL_ADD_LIQUIDITY_FORM_STATE: AddLiquidityFormState = {
  syAmount: '',
  ptAmount: '',
  slippageBps: 50,
  isBalanced: true,
  inputType: 'dual',
};

function addLiquidityFormReducer(
  state: AddLiquidityFormState,
  patch: Partial<AddLiquidityFormState>
): AddLiquidityFormState {
  return { ...state, ...patch };
}

const INPUT_TYPE_OPTIONS = [
  { label: 'SY + PT', value: 'dual' as const },
  { label: 'SY Only', value: 'sy-only' as const },
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
  inputType: InputType;
  isPreviewLoading: boolean;
}

function getButtonText(params: ButtonTextParams): string {
  const {
    isAdding,
    isConnected,
    isValidAmount,
    hasInsufficientSyBalance,
    hasInsufficientPtBalance,
    isSuccess,
    inputType,
    isPreviewLoading,
  } = params;
  if (isAdding) return 'Adding Liquidity...';
  if (!isConnected) return 'Connect Wallet';
  if (!isValidAmount) return inputType === 'sy-only' ? 'Enter SY Amount' : 'Enter Amounts';
  if (hasInsufficientSyBalance) return 'Insufficient SY Balance';
  if (hasInsufficientPtBalance) return 'Insufficient PT Balance';
  if (isPreviewLoading) return 'Loading Preview...';
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

export function AddLiquidityForm(props: AddLiquidityFormProps): ReactNode {
  return useAddLiquidityFormContent(props);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Multi-mode liquidity form with dual/SY-only deposits, balanced mode toggle, and on-chain preview - inherent UI complexity
function useAddLiquidityFormContent({ market, className }: AddLiquidityFormProps): ReactNode {
  const { isConnected, address } = useAccount();
  const { network } = useStarknet();
  const [formState, updateFormState] = useReducer(
    addLiquidityFormReducer,
    INITIAL_ADD_LIQUIDITY_FORM_STATE
  );
  const { syAmount, ptAmount, slippageBps, isBalanced, inputType } = formState;
  const setSyAmount = useCallback((value: string): void => {
    updateFormState({ syAmount: value });
  }, []);
  const setPtAmount = useCallback((value: string): void => {
    updateFormState({ ptAmount: value });
  }, []);
  const setSlippageBps = useCallback((value: number): void => {
    updateFormState({ slippageBps: value });
  }, []);

  const addresses = getAddresses(network);

  // Dual-asset liquidity hook (SY + PT)
  const {
    addLiquidityAsync,
    isAdding: isAddingDual,
    isSuccess: isSuccessDual,
    isError: isErrorDual,
    error: errorDual,
    transactionHash: txHashDual,
  } = useAddLiquidity();

  // Single-sided SY liquidity hook
  const {
    addLiquiditySingleSyAsync,
    isAdding: isAddingSy,
    isSuccess: isSuccessSy,
    isError: isErrorSy,
    error: errorSy,
    transactionHash: txHashSy,
  } = useAddLiquiditySingleSy();

  // Combine states based on input type
  const isAdding = inputType === 'dual' ? isAddingDual : isAddingSy;
  const isSuccess = inputType === 'dual' ? isSuccessDual : isSuccessSy;
  const isError = inputType === 'dual' ? isErrorDual : isErrorSy;
  const error = inputType === 'dual' ? errorDual : errorSy;
  const transactionHash = inputType === 'dual' ? txHashDual : txHashSy;

  // Get token symbols from metadata for proper naming (I-06)
  const tokenSymbol = market.metadata?.yieldTokenSymbol ?? 'Token';
  const sySymbol = `SY-${tokenSymbol}`;
  const ptSymbol = `PT-${tokenSymbol}`;

  // Fetch balances
  const { data: syBalance } = useTokenBalance(market.syAddress);
  const { data: ptBalance } = useTokenBalance(market.ptAddress);

  // Parse amounts
  const parsedSyAmount = useMemo(() => parseAmountSafe(syAmount), [syAmount]);
  const balancedPtAmount = useMemo(() => {
    if (isBalanced && syAmount && market.state.syReserve > BigInt(0)) {
      const { ptAmount: calculatedPt } = calculateBalancedAmounts(
        parsedSyAmount,
        true,
        market.state.syReserve,
        market.state.ptReserve
      );
      return formatWad(calculatedPt, 18);
    }
    return ptAmount;
  }, [
    isBalanced,
    syAmount,
    parsedSyAmount,
    market.state.syReserve,
    market.state.ptReserve,
    ptAmount,
  ]);
  const displayPtAmount = inputType === 'dual' ? balancedPtAmount : ptAmount;
  const parsedPtAmount = useMemo(() => parseAmountSafe(displayPtAmount), [displayPtAmount]);

  // Preview single-SY add liquidity using on-chain calculation
  const { data: syOnlyPreview, isLoading: isSyPreviewLoading } = useAddLiquidityPreview(
    market.address,
    inputType === 'sy-only' ? parsedSyAmount : undefined,
    { enabled: inputType === 'sy-only' && parsedSyAmount > 0n }
  );

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

  // Calculate minimum LP output with slippage (dual mode)
  const minLpOutDual = useMemo(() => {
    return calculateMinLpOut(
      parsedSyAmount,
      parsedPtAmount,
      market.state.syReserve,
      market.state.ptReserve,
      market.state.totalLpSupply,
      slippageBps
    );
  }, [parsedSyAmount, parsedPtAmount, market.state, slippageBps]);

  // Calculate minimum LP output for single-SY mode using on-chain preview
  const minLpOutSyOnly = useMemo(() => {
    if (!syOnlyPreview?.expectedLpOut) return 0n;
    return (syOnlyPreview.expectedLpOut * BigInt(10000 - slippageBps)) / BigInt(10000);
  }, [syOnlyPreview?.expectedLpOut, slippageBps]);

  // Select the appropriate minLpOut based on input type
  const minLpOut = inputType === 'dual' ? minLpOutDual : minLpOutSyOnly;

  // Build calls for gas estimation based on input type
  const addLiquidityCalls = useMemo(() => {
    if (!address || parsedSyAmount === BigInt(0)) return null;
    try {
      if (inputType === 'sy-only') {
        return buildAddLiquiditySingleSyCalls(addresses.router, address, {
          marketAddress: market.address,
          syAddress: market.syAddress,
          syAmount: parsedSyAmount,
          minLpOut: minLpOutSyOnly,
        });
      }
      // Dual mode requires PT amount
      if (parsedPtAmount === BigInt(0)) return null;
      return buildAddLiquidityCalls(addresses.router, address, {
        marketAddress: market.address,
        syAddress: market.syAddress,
        ptAddress: market.ptAddress,
        syAmount: parsedSyAmount,
        ptAmount: parsedPtAmount,
        minLpOut: minLpOutDual,
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
    minLpOutDual,
    minLpOutSyOnly,
    inputType,
  ]);

  // Estimate gas fee
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: isEstimatingFee,
    error: feeError,
  } = useEstimateFee(addLiquidityCalls);

  // Calculate share of pool based on input type
  const poolShare = useMemo(() => {
    // Use on-chain preview LP output for SY-only mode, local calculation for dual mode
    const lpOut = inputType === 'sy-only' ? (syOnlyPreview?.expectedLpOut ?? 0n) : expectedLpOut;
    if (lpOut === BigInt(0)) return new BigNumber(0);
    const newTotalSupply = market.state.totalLpSupply + lpOut;
    if (newTotalSupply === BigInt(0)) return new BigNumber(100);
    return new BigNumber(lpOut.toString()).dividedBy(newTotalSupply.toString()).multipliedBy(100);
  }, [expectedLpOut, syOnlyPreview?.expectedLpOut, inputType, market.state.totalLpSupply]);

  // Validation
  const hasInsufficientSyBalance = syBalance !== undefined && parsedSyAmount > syBalance;
  const hasInsufficientPtBalance =
    inputType === 'dual' && ptBalance !== undefined && parsedPtAmount > ptBalance;
  // For single-SY mode, only require SY amount
  // For dual mode, require both SY and PT amounts
  const isValidAmount =
    inputType === 'sy-only'
      ? parsedSyAmount > BigInt(0)
      : parsedSyAmount > BigInt(0) && parsedPtAmount > BigInt(0);
  // For SY-only mode, require the preview to be loaded to ensure proper slippage protection
  const isPreviewReady = inputType !== 'sy-only' || syOnlyPreview?.expectedLpOut !== undefined;

  const canAddLiquidity =
    isConnected &&
    isValidAmount &&
    !hasInsufficientSyBalance &&
    !hasInsufficientPtBalance &&
    !isAdding &&
    !isSuccess &&
    isPreviewReady;

  // Determine transaction status
  const txStatus = useMemo(
    () => determineTxStatus(isAdding, isSuccess, isError),
    [isAdding, isSuccess, isError]
  );

  // Transaction steps for StepProgress (varies by input type)
  const transactionSteps: Step[] = useMemo(() => {
    if (inputType === 'sy-only') {
      return [
        { label: 'Approve SY', description: `Approve ${sySymbol} spending` },
        { label: 'Add Liquidity', description: 'Deposit SY to pool' },
      ];
    }
    return [
      { label: 'Approve SY', description: `Approve ${sySymbol} spending` },
      { label: 'Approve PT', description: `Approve ${ptSymbol} spending` },
      { label: 'Add Liquidity', description: 'Deposit tokens to pool' },
    ];
  }, [sySymbol, ptSymbol, inputType]);

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

  // Handle add liquidity based on input type
  const handleAddLiquidity = async (): Promise<void> => {
    if (!canAddLiquidity) return;

    if (inputType === 'sy-only') {
      await addLiquiditySingleSyAsync({
        marketAddress: market.address,
        syAddress: market.syAddress,
        syAmount: parsedSyAmount,
        minLpOut: minLpOutSyOnly,
      });
    } else {
      await addLiquidityAsync({
        marketAddress: market.address,
        syAddress: market.syAddress,
        ptAddress: market.ptAddress,
        syAmount: parsedSyAmount,
        ptAmount: parsedPtAmount,
        minLpOut: minLpOutDual,
      });
    }
    updateFormState({ syAmount: '', ptAmount: '' });
  };

  // Handle balanced mode toggle with confirmation feedback
  const handleBalancedChange = useCallback((checked: boolean): void => {
    updateFormState({ isBalanced: checked });
    toast.success(checked ? 'Balanced deposit enabled' : 'Custom amounts enabled', {
      description: checked
        ? 'PT amount will auto-calculate based on pool ratio'
        : 'You can now set custom SY and PT amounts',
      duration: 2000,
    });
  }, []);

  // Handle input type change - reset PT amount when switching to SY-only mode
  const handleInputTypeChange = useCallback(
    (newType: InputType): void => {
      if (newType === inputType) return;
      updateFormState({ inputType: newType, ptAmount: newType === 'sy-only' ? '' : ptAmount });
      // Reset PT amount when switching to SY-only to avoid stale state
    },
    [inputType, ptAmount]
  );

  return (
    <FormLayout gradient="primary" className={className}>
      {/* Header */}
      <FormHeader title="Add Liquidity" />

      {/* Input Type Selector */}
      <div>
        <div className="text-muted-foreground mb-2 text-sm">Deposit type</div>
        <ToggleGroup className="flex gap-1">
          {INPUT_TYPE_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              pressed={inputType === option.value}
              onPressedChange={() => {
                handleInputTypeChange(option.value);
              }}
              variant="outline"
              size="sm"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Balanced Mode Toggle - only for dual mode */}
      {inputType === 'dual' && (
        <div className="flex items-center gap-2">
          <Switch checked={isBalanced} onCheckedChange={handleBalancedChange} />
          <span className="text-muted-foreground text-sm">Balanced deposit</span>
        </div>
      )}

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
        {inputType === 'dual' && (
          <TokenInput
            label="PT Amount"
            tokenAddress={market.ptAddress}
            tokenSymbol={ptSymbol}
            value={displayPtAmount}
            onChange={(value): void => {
              if (!isBalanced) {
                setPtAmount(value);
              }
            }}
            disabled={isBalanced}
            error={hasInsufficientPtBalance ? 'Insufficient balance' : undefined}
          />
        )}
      </FormInputSection>

      {/* Output Preview */}
      <Card size="sm" className="bg-muted">
        <CardContent className="p-4">
          {inputType === 'sy-only' ? (
            // Single-SY mode with on-chain preview
            isSyPreviewLoading && isValidAmount ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-lg font-semibold">
                  Loading preview&hellip;
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Expected LP (on-chain)</span>
                  <span className="text-muted-foreground text-sm">
                    Min: {isValidAmount && syOnlyPreview ? formatWad(minLpOutSyOnly, 6) : '-'} LP
                  </span>
                </div>
                <div className="text-foreground mt-2 text-2xl font-semibold">
                  {isValidAmount && syOnlyPreview
                    ? formatWad(syOnlyPreview.expectedLpOut, 6)
                    : '0.000000'}{' '}
                  LP
                </div>
                {!syOnlyPreview && isValidAmount && !isSyPreviewLoading && (
                  <div className="text-muted-foreground mt-1 text-xs">
                    Preview unavailable - using estimated values
                  </div>
                )}
              </>
            )
          ) : (
            // Dual mode with local calculation
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Expected LP Tokens</span>
                <span className="text-muted-foreground text-sm">
                  Min: {isValidAmount ? formatWad(minLpOut, 6) : '-'} LP
                </span>
              </div>
              <div className="text-foreground mt-2 text-2xl font-semibold">
                {isValidAmount ? formatWad(expectedLpOut, 6) : '0.000000'} LP
              </div>
            </>
          )}
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
              {option.percent}
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
            inputType,
            isPreviewLoading: inputType === 'sy-only' && isSyPreviewLoading && isValidAmount,
          })}
        </Button>
      </FormActions>
    </FormLayout>
  );
}
