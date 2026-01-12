import { cn } from "@shared/lib/utils";
import { formatApyPercent, getApyColorClass } from "@shared/math/apy-breakdown";
import { Card, CardContent } from "@shared/ui/Card";
import { type JSX, Show, splitProps } from "solid-js";
import type { MarketApyBreakdown } from "@/types/apy";

interface ApyBreakdownProps {
	breakdown: MarketApyBreakdown;
	view: "pt" | "yt" | "lp";
	class?: string;
}

interface TooltipProps {
	content: string;
	children: JSX.Element;
}

function Tooltip(props: TooltipProps): JSX.Element {
	return (
		<button
			type="button"
			class="group relative cursor-help border-none bg-transparent p-0"
			aria-label={props.content}
		>
			{props.children}
			<span
				class="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus:opacity-100"
				role="tooltip"
			>
				{props.content}
			</span>
		</button>
	);
}

function InfoIcon(props: { class?: string }): JSX.Element {
	return (
		<svg
			class={cn("h-3 w-3", props.class)}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden="true"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width={2}
				d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
	);
}

export function ApyBreakdown(props: ApyBreakdownProps): JSX.Element {
	const [local] = splitProps(props, ["breakdown", "view", "class"]);

	return (
		<div class={cn("space-y-4", local.class)}>
			{/* PT Fixed APY View */}
			<Show when={local.view === "pt"}>
				<div class="border-primary/30 bg-primary/10 rounded-lg border p-4">
					<div class="text-primary text-sm">Fixed APY</div>
					<div class="text-primary text-2xl font-bold">
						{formatApyPercent(local.breakdown.ptFixedApy)}
					</div>
					<div class="text-primary/80 mt-1 text-xs">Guaranteed at maturity</div>
				</div>
			</Show>

			{/* YT Long Yield APY View */}
			<Show when={local.view === "yt"}>
				<div class="space-y-3">
					<div class="border-accent/30 bg-accent/10 rounded-lg border p-4">
						<div class="text-foreground text-sm">Long Yield APY</div>
						<div
							class={cn(
								"text-2xl font-bold",
								local.breakdown.ytApy.longYieldApy >= 0
									? "text-primary"
									: "text-destructive",
							)}
						>
							{formatApyPercent(local.breakdown.ytApy.longYieldApy)}
						</div>
						<div class="text-muted-foreground mt-1 text-xs">
							{local.breakdown.ytApy.leverage.toFixed(1)}x leverage
						</div>
					</div>

					<div class="space-y-2">
						<ApyRow
							label="Break-even APY"
							value={local.breakdown.ytApy.breakEvenApy}
							tooltip="Underlying APY needed to break even on YT purchase"
						/>
						<ApyRow
							label="Current Underlying APY"
							value={local.breakdown.underlying.totalApy}
							tooltip="Current yield rate of the underlying asset"
							highlight={
								local.breakdown.underlying.totalApy >
								local.breakdown.ytApy.breakEvenApy
							}
						/>
					</div>
				</div>
			</Show>

			{/* LP APY View */}
			<Show when={local.view === "lp"}>
				<div class="space-y-3">
					<div class="border-secondary bg-secondary rounded-lg border p-4">
						<div class="text-secondary-foreground/80 text-sm">Total LP APY</div>
						<div class="text-secondary-foreground text-2xl font-bold">
							{formatApyPercent(local.breakdown.lpApy.total)}
						</div>
					</div>

					<div class="text-foreground text-sm font-medium">Breakdown</div>

					<div class="space-y-2">
						<ApyRow
							label="PT Yield"
							value={local.breakdown.lpApy.ptYield}
							tooltip="Your share of PT fixed yield based on pool composition"
						/>
						<ApyRow
							label="Underlying Yield"
							value={local.breakdown.lpApy.syYield}
							tooltip="Yield from SY portion of your LP position"
						/>
						<ApyRow
							label="Swap Fees"
							value={local.breakdown.lpApy.swapFees}
							tooltip="Your share of trading fees (20% of swap fees go to LPs)"
						/>
						<Show when={local.breakdown.lpApy.rewards > 0}>
							<ApyRow
								label="Rewards"
								value={local.breakdown.lpApy.rewards}
								tooltip="Protocol incentive rewards"
							/>
						</Show>
					</div>
				</div>
			</Show>

			{/* Underlying breakdown (always shown) */}
			<div class="border-border border-t pt-3">
				<div class="text-muted-foreground mb-2 text-xs font-medium">
					Underlying Asset Yield
				</div>
				<div class="space-y-1">
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Interest APY</span>
						<span
							class={getApyColorClass(local.breakdown.underlying.interestApy)}
						>
							{formatApyPercent(local.breakdown.underlying.interestApy)}
						</span>
					</div>
					<Show when={local.breakdown.underlying.rewardsApr > 0}>
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Rewards APR</span>
							<span class="text-foreground">
								{formatApyPercent(local.breakdown.underlying.rewardsApr)}
							</span>
						</div>
					</Show>
				</div>
			</div>
		</div>
	);
}

interface ApyRowProps {
	label: string;
	value: number;
	tooltip: string;
	highlight?: boolean;
}

function ApyRow(props: ApyRowProps): JSX.Element {
	return (
		<div class="flex items-center justify-between">
			<span class="text-muted-foreground flex items-center gap-1 text-sm">
				{props.label}
				<Tooltip content={props.tooltip}>
					<InfoIcon />
				</Tooltip>
			</span>
			<span
				class={cn(
					"text-sm font-medium",
					props.highlight ? "text-primary" : getApyColorClass(props.value),
				)}
			>
				{formatApyPercent(props.value)}
			</span>
		</div>
	);
}

/**
 * Compact APY display for cards and lists
 */
interface ApyCompactProps {
	breakdown: MarketApyBreakdown;
	view: "pt" | "yt" | "lp";
	class?: string;
}

export function ApyCompact(props: ApyCompactProps): JSX.Element {
	const [local] = splitProps(props, ["breakdown", "view", "class"]);

	const getApy = (): number => {
		switch (local.view) {
			case "pt":
				return local.breakdown.ptFixedApy;
			case "yt":
				return local.breakdown.ytApy.longYieldApy;
			case "lp":
				return local.breakdown.lpApy.total;
		}
	};

	const getLabel = (): string => {
		switch (local.view) {
			case "pt":
				return "Fixed APY";
			case "yt":
				return "Long Yield";
			case "lp":
				return "LP APY";
		}
	};

	return (
		<div class={cn("flex flex-col", local.class)}>
			<span class="text-muted-foreground text-xs">{getLabel()}</span>
			<span class={cn("text-lg font-semibold", getApyColorClass(getApy()))}>
				{formatApyPercent(getApy())}
			</span>
		</div>
	);
}

/**
 * APY Breakdown Card wrapper
 */
interface ApyBreakdownCardProps {
	breakdown: MarketApyBreakdown;
	view: "pt" | "yt" | "lp";
	title?: string;
	class?: string;
}

export function ApyBreakdownCard(props: ApyBreakdownCardProps): JSX.Element {
	const [local] = splitProps(props, ["breakdown", "view", "title", "class"]);

	const defaultTitle = (): string => {
		switch (local.view) {
			case "pt":
				return "PT Yield";
			case "yt":
				return "YT Yield";
			case "lp":
				return "LP Yield";
		}
	};

	return (
		<Card class={local.class}>
			<CardContent class="p-4">
				<h3 class="text-foreground mb-3 text-sm font-medium">
					{local.title ?? defaultTitle()}
				</h3>
				<ApyBreakdown breakdown={local.breakdown} view={local.view} />
			</CardContent>
		</Card>
	);
}
