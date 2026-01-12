# SolidJS Frontend Port - Implementation Plan

## Phase 1: Project Scaffolding **COMPLETE**

Initialize Solid Start project with TypeScript, Tailwind CSS 4, and essential tooling.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 1: Create package.json with dependencies **COMPLETE**

#### Goal
Create package.json with Solid Start, @tanstack/solid-query, @kobalte/core, starknet.js, and essential dependencies matching the React frontend's library versions.

#### Files
- `packages/frontend-solid/package.json` - Create with all dependencies

#### Validation
```bash
cd packages/frontend-solid && bun install && echo "OK"
```

#### Failure modes
- Dependency version conflicts between Solid Start and other packages
- Missing peer dependencies for @kobalte/core or @tanstack/solid-query

---

### Step 2: Create TypeScript configuration **COMPLETE**

#### Goal
Set up tsconfig.json with strict mode, path aliases matching React frontend (@shared/*, @features/*, @entities/*, etc.), and SolidJS JSX support.

#### Files
- `packages/frontend-solid/tsconfig.json` - Create with path aliases and strict settings

#### Validation
```bash
cd packages/frontend-solid && bun run tsc --noEmit && echo "OK"
```

#### Failure modes
- Path alias resolution failures
- JSX preserve mode conflicts with Solid

---

### Step 3: Create Solid Start configuration **COMPLETE**

#### Goal
Configure app.config.ts with Vinxi/Solid Start settings, server-side rendering mode, and Tailwind integration.

#### Files
- `packages/frontend-solid/app.config.ts` - Solid Start configuration
- `packages/frontend-solid/postcss.config.mjs` - PostCSS with Tailwind plugin

#### Validation
```bash
cd packages/frontend-solid && bun run dev --help
```

#### Failure modes
- Vinxi configuration errors
- PostCSS plugin loading failures

---

### Step 4: Copy globals.css with Tailwind configuration **COMPLETE**

#### Goal
Copy globals.css from React frontend preserving all CSS variables (OKLCH colors, spacing tokens, animations, keyframes) and Tailwind 4 imports.

#### Files
- `packages/frontend-solid/src/app.css` - Copy from `packages/frontend/src/app/globals.css`

#### Validation
```bash
grep -q "oklch" packages/frontend-solid/src/app.css && grep -q "@import 'tailwindcss'" packages/frontend-solid/src/app.css && echo "OK"
```

#### Failure modes
- Missing CSS variable definitions
- Tailwind import syntax incompatible with Solid Start

---

### Step 5: Create root layout and entry files **COMPLETE**

#### Goal
Create app.tsx (root component), entry-server.tsx, and entry-client.tsx with proper Solid Start structure.

#### Files
- `packages/frontend-solid/src/app.tsx` - Root app component with HTML structure
- `packages/frontend-solid/src/entry-server.tsx` - Server entry
- `packages/frontend-solid/src/entry-client.tsx` - Client entry with hydration

#### Validation
```bash
cd packages/frontend-solid && bun run dev &
sleep 5 && curl -s http://localhost:3000 | grep -q "html" && echo "OK"
```

#### Failure modes
- Hydration mismatch between server and client
- Missing font imports or CSS loading

---

## Phase 2: Shared Utilities (Pure Functions) **COMPLETE**

Copy framework-agnostic utilities that require no modification.

### Phase Validation
```bash
cd packages/frontend-solid && bun run tsc --noEmit
```

### Step 6: Copy math utilities **COMPLETE**

#### Goal
Copy WAD fixed-point math utilities (wad.ts, fp.ts, amm.ts, yield.ts, apy-breakdown.ts) that have no React dependencies.

#### Files
- `packages/frontend-solid/src/shared/math/wad.ts` - Copy from React frontend
- `packages/frontend-solid/src/shared/math/fp.ts` - Copy from React frontend
- `packages/frontend-solid/src/shared/math/amm.ts` - Copy from React frontend
- `packages/frontend-solid/src/shared/math/yield.ts` - Copy from React frontend
- `packages/frontend-solid/src/shared/math/apy-breakdown.ts` - Copy from React frontend
- `packages/frontend-solid/src/shared/math/index.ts` - Create barrel export

#### Validation
```bash
grep -q "WAD_BIGINT" packages/frontend-solid/src/shared/math/wad.ts && echo "OK"
```

#### Failure modes
- BigNumber.js import path issues

---

### Step 7: Copy configuration utilities **COMPLETE**

#### Goal
Copy network addresses, constants, and chart theme configuration.

#### Files
- `packages/frontend-solid/src/shared/config/addresses.ts` - Copy with path alias updates
- `packages/frontend-solid/src/shared/config/chartTheme.ts` - Copy from React frontend
- `packages/frontend-solid/src/shared/config/twap.ts` - Copy from React frontend
- `packages/frontend-solid/src/shared/config/index.ts` - Create barrel export

#### Validation
```bash
grep -q "getAddresses" packages/frontend-solid/src/shared/config/addresses.ts && echo "OK"
```

#### Failure modes
- @deploy path alias not resolving to JSON files

---

### Step 8: Copy Starknet contract utilities **COMPLETE**

#### Goal
Copy contract factory functions (contracts.ts), provider setup, and wallet utilities.

#### Files
- `packages/frontend-solid/src/shared/starknet/contracts.ts` - Copy from React frontend
- `packages/frontend-solid/src/shared/starknet/provider.ts` - Copy from React frontend
- `packages/frontend-solid/src/shared/starknet/wallet.ts` - Copy from React frontend
- `packages/frontend-solid/src/shared/starknet/transaction-builder.ts` - Copy from React frontend
- `packages/frontend-solid/src/shared/starknet/index.ts` - Create barrel export

#### Validation
```bash
grep -q "getRouterContract" packages/frontend-solid/src/shared/starknet/contracts.ts && echo "OK"
```

#### Failure modes
- starknet.js type imports failing
- ABI type imports from @/types/generated failing

---

### Step 9: Copy generated contract types **COMPLETE**

#### Goal
Copy ABI-generated TypeScript types for all contracts (Router, Market, SY, PT, YT, etc.).

#### Files
- `packages/frontend-solid/src/types/generated/Factory.ts` - Copy from React frontend
- `packages/frontend-solid/src/types/generated/Market.ts` - Copy from React frontend
- `packages/frontend-solid/src/types/generated/MarketFactory.ts` - Copy from React frontend
- `packages/frontend-solid/src/types/generated/Router.ts` - Copy from React frontend
- `packages/frontend-solid/src/types/generated/SY.ts` - Copy from React frontend
- `packages/frontend-solid/src/types/generated/SYWithRewards.ts` - Copy from React frontend
- `packages/frontend-solid/src/types/generated/PT.ts` - Copy from React frontend
- `packages/frontend-solid/src/types/generated/YT.ts` - Copy from React frontend
- `packages/frontend-solid/src/types/generated/PragmaIndexOracle.ts` - Copy from React frontend
- `packages/frontend-solid/src/types/generated/PyLpOracle.ts` - Copy from React frontend
- `packages/frontend-solid/src/types/generated/index.ts` - Copy barrel export

#### Validation
```bash
grep -q "ROUTER_ABI" packages/frontend-solid/src/types/generated/index.ts && echo "OK"
```

#### Failure modes
- Type definitions incompatible with newer starknet.js version

---

### Step 10: Copy utility functions **COMPLETE**

#### Goal
Copy cn() class merge utility, deadline calculation, error handling, and BigInt JSON polyfill.

#### Files
- `packages/frontend-solid/src/shared/lib/utils.ts` - Copy cn() function
- `packages/frontend-solid/src/shared/lib/deadline.ts` - Copy deadline calculation
- `packages/frontend-solid/src/shared/lib/errors.ts` - Copy error utilities
- `packages/frontend-solid/src/shared/lib/fees.ts` - Copy fee utilities
- `packages/frontend-solid/src/shared/lib/polyfills/bigint-json.ts` - Copy BigInt serialization polyfill
- `packages/frontend-solid/src/shared/lib/index.ts` - Create barrel export

#### Validation
```bash
grep -q "twMerge" packages/frontend-solid/src/shared/lib/utils.ts && echo "OK"
```

#### Failure modes
- clsx or tailwind-merge import failures

---

## Phase 3: Core Providers **COMPLETE**

Port React context providers to SolidJS contexts with signals.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 11: Create QueryProvider with @tanstack/solid-query **COMPLETE**

#### Goal
Port QueryProvider to use @tanstack/solid-query's QueryClientProvider with identical configuration (staleTime: 1 minute, structuralSharing: false).

#### Files
- `packages/frontend-solid/src/providers/QueryProvider.tsx` - Create SolidJS QueryProvider

#### Validation
```bash
grep -q "QueryClientProvider" packages/frontend-solid/src/providers/QueryProvider.tsx && echo "OK"
```

#### Failure modes
- @tanstack/solid-query API differences from react-query
- QueryClient configuration options changed

---

### Step 12: Create StarknetProvider with SolidJS signals **COMPLETE**

#### Goal
Port StarknetProvider replacing useState with createSignal, useEffect with createEffect, useCallback with regular functions, and useMemo with createMemo.

#### Files
- `packages/frontend-solid/src/providers/StarknetProvider.tsx` - Create SolidJS StarknetProvider with signals

#### Validation
```bash
grep -q "createSignal" packages/frontend-solid/src/providers/StarknetProvider.tsx && grep -q "createContext" packages/frontend-solid/src/providers/StarknetProvider.tsx && echo "OK"
```

#### Failure modes
- Reactivity broken due to destructuring signals
- Wallet event listener cleanup not working with onCleanup

---

### Step 13: Create ThemeProvider with CSS class-based dark mode **COMPLETE**

#### Goal
Create ThemeProvider that manages dark mode via CSS class on document element, using createSignal and localStorage persistence.

#### Files
- `packages/frontend-solid/src/providers/ThemeProvider.tsx` - Create SolidJS ThemeProvider

#### Validation
```bash
grep -q "createSignal" packages/frontend-solid/src/providers/ThemeProvider.tsx && grep -q "dark" packages/frontend-solid/src/providers/ThemeProvider.tsx && echo "OK"
```

#### Failure modes
- SSR hydration mismatch when reading localStorage
- Theme flash on page load

---

### Step 14: Create UIModeProvider (simple/advanced toggle) **COMPLETE**

#### Goal
Port UIModeProvider with createSignal for mode state and localStorage persistence.

#### Files
- `packages/frontend-solid/src/providers/UIModeProvider.tsx` - Create SolidJS UIModeProvider

#### Validation
```bash
grep -q "UIMode" packages/frontend-solid/src/providers/UIModeProvider.tsx && echo "OK"
```

#### Failure modes
- localStorage access failing during SSR

---

### Step 15: Create TransactionSettingsProvider **COMPLETE**

#### Goal
Port TransactionSettingsProvider with createSignal for slippage/deadline settings and localStorage persistence.

#### Files
- `packages/frontend-solid/src/providers/TransactionSettingsProvider.tsx` - Create SolidJS TransactionSettingsProvider

#### Validation
```bash
grep -q "slippageBps" packages/frontend-solid/src/providers/TransactionSettingsProvider.tsx && echo "OK"
```

#### Failure modes
- Validation logic not applying correctly with signals

---

### Step 16: Create Providers composition component **COMPLETE**

#### Goal
Create root Providers component that composes all providers in correct nesting order: Theme → Query → Starknet → UIMode → TransactionSettings.

#### Files
- `packages/frontend-solid/src/providers/index.tsx` - Create Providers composition

#### Validation
```bash
grep -q "ThemeProvider" packages/frontend-solid/src/providers/index.tsx && grep -q "StarknetProvider" packages/frontend-solid/src/providers/index.tsx && echo "OK"
```

#### Failure modes
- Provider nesting order causing context access errors

---

## Phase 4: Base UI Components (Kobalte) **COMPLETE**

Port shadcn/ui components to Kobalte equivalents with identical Tailwind styling.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 17: Create Button component **COMPLETE**

#### Goal
Port Button component with CVA variants, loading state, and all size/variant combinations using Kobalte Button primitive.

#### Files
- `packages/frontend-solid/src/shared/ui/Button.tsx` - Create SolidJS Button with Kobalte

#### Validation
```bash
grep -q "buttonVariants" packages/frontend-solid/src/shared/ui/Button.tsx && echo "OK"
```

#### Failure modes
- CVA variant types not compatible with SolidJS
- Kobalte Button API differences from @base-ui/react

---

### Step 18: Create Card component **COMPLETE**

#### Goal
Port Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter components with interactive mode.

#### Files
- `packages/frontend-solid/src/shared/ui/Card.tsx` - Create SolidJS Card components

#### Validation
```bash
grep -q "CardContent" packages/frontend-solid/src/shared/ui/Card.tsx && echo "OK"
```

#### Failure modes
- data-slot attributes not working with SolidJS

---

### Step 19: Create Dialog component with Kobalte **COMPLETE**

#### Goal
Port Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter using Kobalte Dialog.

#### Files
- `packages/frontend-solid/src/shared/ui/Dialog.tsx` - Create SolidJS Dialog with Kobalte

#### Validation
```bash
grep -q "Dialog.Root" packages/frontend-solid/src/shared/ui/Dialog.tsx && echo "OK"
```

#### Failure modes
- Kobalte Dialog portal rendering differently
- Animation classes not applying on open/close

---

### Step 20: Create Select component with Kobalte **COMPLETE**

#### Goal
Port Select, SelectTrigger, SelectContent, SelectItem, SelectValue using Kobalte Select.

#### Files
- `packages/frontend-solid/src/shared/ui/Select.tsx` - Create SolidJS Select with Kobalte

#### Validation
```bash
grep -q "Select.Root" packages/frontend-solid/src/shared/ui/Select.tsx && echo "OK"
```

#### Failure modes
- Kobalte Select controlled mode API differences
- SelectValue rendering issues

---

### Step 21: Create Input component **COMPLETE**

#### Goal
Port Input component with focus ring styling and all input variants.

#### Files
- `packages/frontend-solid/src/shared/ui/Input.tsx` - Create SolidJS Input

#### Validation
```bash
grep -q "input" packages/frontend-solid/src/shared/ui/Input.tsx && echo "OK"
```

#### Failure modes
- Input ref forwarding in SolidJS

---

### Step 22: Create Tabs component with Kobalte **COMPLETE**

#### Goal
Port Tabs, TabsList, TabsTrigger, TabsContent using Kobalte Tabs.

#### Files
- `packages/frontend-solid/src/shared/ui/Tabs.tsx` - Create SolidJS Tabs with Kobalte

#### Validation
```bash
grep -q "Tabs.Root" packages/frontend-solid/src/shared/ui/Tabs.tsx && echo "OK"
```

#### Failure modes
- Kobalte Tabs value binding API differences

---

### Step 23: Create Badge component **COMPLETE**

#### Goal
Port Badge component with all variant styles.

#### Files
- `packages/frontend-solid/src/shared/ui/Badge.tsx` - Create SolidJS Badge

#### Validation
```bash
grep -q "badgeVariants" packages/frontend-solid/src/shared/ui/Badge.tsx && echo "OK"
```

#### Failure modes
- CVA variant type inference

---

### Step 24: Create Skeleton components **COMPLETE**

#### Goal
Port all Skeleton variants (Skeleton, SkeletonCard, MarketCardSkeleton, ChartSkeleton, etc.) for loading states.

#### Files
- `packages/frontend-solid/src/shared/ui/Skeleton.tsx` - Create SolidJS Skeleton components

#### Validation
```bash
grep -q "MarketCardSkeleton" packages/frontend-solid/src/shared/ui/Skeleton.tsx && echo "OK"
```

#### Failure modes
- Animation classes not applying

---

### Step 25: Create Toast component with Kobalte **COMPLETE**

#### Goal
Port Toaster using Kobalte Toast with sonner-like API for notifications.

#### Files
- `packages/frontend-solid/src/shared/ui/Toast.tsx` - Create SolidJS Toast with Kobalte
- `packages/frontend-solid/src/shared/ui/Toaster.tsx` - Create Toaster container

#### Validation
```bash
grep -q "Toast" packages/frontend-solid/src/shared/ui/Toast.tsx && echo "OK"
```

#### Failure modes
- Toast queue management differences from sonner

---

### Step 26: Create remaining UI primitives **COMPLETE**

#### Goal
Port Alert, Progress, Slider, Switch, Toggle, ToggleGroup, Label, Separator, Collapsible, DropdownMenu, HoverCard.

#### Files
- `packages/frontend-solid/src/shared/ui/Alert.tsx` - Create SolidJS Alert
- `packages/frontend-solid/src/shared/ui/Progress.tsx` - Create SolidJS Progress with Kobalte
- `packages/frontend-solid/src/shared/ui/Slider.tsx` - Create SolidJS Slider with Kobalte
- `packages/frontend-solid/src/shared/ui/Switch.tsx` - Create SolidJS Switch with Kobalte
- `packages/frontend-solid/src/shared/ui/Toggle.tsx` - Create SolidJS Toggle with Kobalte
- `packages/frontend-solid/src/shared/ui/ToggleGroup.tsx` - Create SolidJS ToggleGroup
- `packages/frontend-solid/src/shared/ui/Label.tsx` - Create SolidJS Label
- `packages/frontend-solid/src/shared/ui/Separator.tsx` - Create SolidJS Separator
- `packages/frontend-solid/src/shared/ui/Collapsible.tsx` - Create SolidJS Collapsible with Kobalte
- `packages/frontend-solid/src/shared/ui/DropdownMenu.tsx` - Create SolidJS DropdownMenu with Kobalte
- `packages/frontend-solid/src/shared/ui/HoverCard.tsx` - Create SolidJS HoverCard with Kobalte

#### Validation
```bash
ls packages/frontend-solid/src/shared/ui/*.tsx | wc -l | grep -q "1[5-9]" && echo "OK"
```

#### Failure modes
- Kobalte primitive API differences

---

### Step 27: Create typography and animation components **COMPLETE**

#### Goal
Port typography components (Display, Heading, Metric, etc.) and animation utilities (AnimatedNumber, Sparkline, etc.).

#### Files
- `packages/frontend-solid/src/shared/ui/Typography.tsx` - Create typography components
- `packages/frontend-solid/src/shared/ui/AnimatedNumber.tsx` - Create AnimatedNumber with SolidJS
- `packages/frontend-solid/src/shared/ui/Animations.tsx` - Create animation wrapper components
- `packages/frontend-solid/src/shared/ui/Sparkline.tsx` - Create Sparkline components

#### Validation
```bash
grep -q "Metric" packages/frontend-solid/src/shared/ui/Typography.tsx && echo "OK"
```

#### Failure modes
- Animation timing issues with SolidJS reactivity

---

### Step 28: Create FormLayout components **COMPLETE**

#### Goal
Port FormLayout, FormInputSection, FormOutputSection, FormActions, FormRow for consistent form structure.

#### Files
- `packages/frontend-solid/src/shared/ui/FormLayout.tsx` - Create form layout components
- `packages/frontend-solid/src/shared/ui/GasEstimate.tsx` - Create GasEstimate component
- `packages/frontend-solid/src/shared/ui/StepProgress.tsx` - Create StepProgress component
- `packages/frontend-solid/src/shared/ui/StatCard.tsx` - Create StatCard component
- `packages/frontend-solid/src/shared/ui/NearExpiryWarning.tsx` - Create NearExpiryWarning

#### Validation
```bash
grep -q "FormLayout" packages/frontend-solid/src/shared/ui/FormLayout.tsx && echo "OK"
```

#### Failure modes
- Layout component prop spreading issues

---

### Step 29: Create UI barrel export **COMPLETE**

#### Goal
Create index.ts barrel export matching React frontend's 65+ component exports.

#### Files
- `packages/frontend-solid/src/shared/ui/index.ts` - Create barrel export

#### Validation
```bash
grep -c "export" packages/frontend-solid/src/shared/ui/index.ts | grep -q "[4-9][0-9]" && echo "OK"
```

#### Failure modes
- Circular dependency issues

---

## Phase 5: Wallet Feature **COMPLETE**

Port wallet connection feature with SolidJS patterns.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 30: Create useStarknet hook **COMPLETE**

#### Goal
Create useStarknet hook that accesses StarknetContext using SolidJS useContext.

#### Files
- `packages/frontend-solid/src/features/wallet/model/useStarknet.ts` - Create useStarknet hook

#### Validation
```bash
grep -q "useContext" packages/frontend-solid/src/features/wallet/model/useStarknet.ts && echo "OK"
```

#### Failure modes
- Context not available when hook called outside provider

---

### Step 31: Create useAccount hook **COMPLETE**

#### Goal
Create useAccount hook that derives account state from wallet context.

#### Files
- `packages/frontend-solid/src/features/wallet/model/useAccount.ts` - Create useAccount hook

#### Validation
```bash
grep -q "useStarknet" packages/frontend-solid/src/features/wallet/model/useAccount.ts && echo "OK"
```

#### Failure modes
- Derived state not updating when wallet changes

---

### Step 32: Create useContracts hook **COMPLETE**

#### Goal
Create useContracts hook that provides typed contract instances.

#### Files
- `packages/frontend-solid/src/features/wallet/model/useContracts.ts` - Create useContracts hook

#### Validation
```bash
grep -q "getRouterContract" packages/frontend-solid/src/features/wallet/model/useContracts.ts && echo "OK"
```

#### Failure modes
- Contract instances not recreating when account changes

---

### Step 33: Create ConnectButton component **COMPLETE**

#### Goal
Port ConnectButton UI with wallet connection modal trigger, connected state display, and disconnect functionality.

#### Files
- `packages/frontend-solid/src/features/wallet/ui/ConnectButton.tsx` - Create SolidJS ConnectButton

#### Validation
```bash
grep -q "connect" packages/frontend-solid/src/features/wallet/ui/ConnectButton.tsx && echo "OK"
```

#### Failure modes
- Button state not reflecting wallet connection status

---

### Step 34: Create DisclaimerDialog component **COMPLETE**

#### Goal
Port DisclaimerDialog with terms acceptance before connecting.

#### Files
- `packages/frontend-solid/src/features/wallet/ui/DisclaimerDialog.tsx` - Create SolidJS DisclaimerDialog

#### Validation
```bash
grep -q "Dialog" packages/frontend-solid/src/features/wallet/ui/DisclaimerDialog.tsx && echo "OK"
```

#### Failure modes
- Dialog not closing after acceptance

---

### Step 35: Create wallet feature barrel export **COMPLETE**

#### Goal
Create index.ts with all wallet feature exports.

#### Files
- `packages/frontend-solid/src/features/wallet/index.ts` - Create barrel export

#### Validation
```bash
grep -q "useAccount" packages/frontend-solid/src/features/wallet/index.ts && echo "OK"
```

#### Failure modes
- Missing exports

---

## Phase 6: Markets Feature

Port market data fetching and display.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 36: Create useMarkets query hook **COMPLETE**

#### Goal
Port useMarkets hook using @tanstack/solid-query createQuery to fetch market list.

#### Files
- `packages/frontend-solid/src/features/markets/model/useMarkets.ts` - Create SolidJS useMarkets

#### Validation
```bash
grep -q "createQuery" packages/frontend-solid/src/features/markets/model/useMarkets.ts && echo "OK"
```

#### Failure modes
- Query key factory not reactive

---

### Step 37: Create useMarket query hook **COMPLETE**

#### Goal
Port useMarket hook for single market details with createQuery.

#### Files
- `packages/frontend-solid/src/features/markets/model/useMarket.ts` - Create SolidJS useMarket

#### Validation
```bash
grep -q "createQuery" packages/frontend-solid/src/features/markets/model/useMarket.ts && echo "OK"
```

#### Failure modes
- Market address parameter not triggering refetch

---

### Step 38: Create useMarketRates query hook **COMPLETE**

#### Goal
Port useMarketRates hook for implied rate history.

#### Files
- `packages/frontend-solid/src/features/markets/model/useMarketRates.ts` - Create SolidJS useMarketRates

#### Validation
```bash
grep -q "createQuery" packages/frontend-solid/src/features/markets/model/useMarketRates.ts && echo "OK"
```

#### Failure modes
- Date range parameters not reactive

---

### Step 39: Create markets feature barrel export **COMPLETE**

#### Goal
Create index.ts with all markets feature exports.

#### Files
- `packages/frontend-solid/src/features/markets/index.ts` - Create barrel export

#### Validation
```bash
grep -q "useMarkets" packages/frontend-solid/src/features/markets/index.ts && echo "OK"
```

#### Failure modes
- Missing exports

---

## Phase 7: Swap Feature

Port the core trading functionality.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 40: Create useSwap mutation hook

#### Goal
Port useSwap hook using createMutation with optimistic updates for balance changes.

#### Files
- `packages/frontend-solid/src/features/swap/model/useSwap.ts` - Create SolidJS useSwap

#### Validation
```bash
grep -q "createMutation" packages/frontend-solid/src/features/swap/model/useSwap.ts && echo "OK"
```

#### Failure modes
- Optimistic update rollback not working
- Mutation context type issues

---

### Step 41: Create swap form logic

#### Goal
Port swapFormLogic.ts with input validation, amount parsing, and swap direction resolution.

#### Files
- `packages/frontend-solid/src/features/swap/lib/swapFormLogic.ts` - Copy from React frontend

#### Validation
```bash
grep -q "resolveSwapTokens" packages/frontend-solid/src/features/swap/lib/swapFormLogic.ts && echo "OK"
```

#### Failure modes
- Pure functions should work unchanged

---

### Step 42: Create SwapForm component

#### Goal
Port SwapForm with token selection, amount input, swap direction toggle, and transaction execution.

#### Files
- `packages/frontend-solid/src/features/swap/ui/SwapForm.tsx` - Create SolidJS SwapForm

#### Validation
```bash
grep -q "useSwap" packages/frontend-solid/src/features/swap/ui/SwapForm.tsx && echo "OK"
```

#### Failure modes
- Form state not reactive
- Input binding issues with createSignal

---

### Step 43: Create SwapDetails component

#### Goal
Port SwapDetails showing price impact, minimum received, fees, and exchange rate.

#### Files
- `packages/frontend-solid/src/features/swap/ui/SwapDetails.tsx` - Create SolidJS SwapDetails

#### Validation
```bash
grep -q "priceImpact" packages/frontend-solid/src/features/swap/ui/SwapDetails.tsx && echo "OK"
```

#### Failure modes
- Computed values not updating

---

### Step 44: Create swap feature barrel export

#### Goal
Create index.ts with all swap feature exports.

#### Files
- `packages/frontend-solid/src/features/swap/index.ts` - Create barrel export

#### Validation
```bash
grep -q "useSwap" packages/frontend-solid/src/features/swap/index.ts && echo "OK"
```

#### Failure modes
- Missing exports

---

## Phase 8: Transaction Settings Feature

Port slippage and deadline configuration.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 45: Create useTransactionSettings hook

#### Goal
Create useTransactionSettings hook that accesses TransactionSettingsContext.

#### Files
- `packages/frontend-solid/src/features/tx-settings/model/useTransactionSettings.ts` - Create hook

#### Validation
```bash
grep -q "useContext" packages/frontend-solid/src/features/tx-settings/model/useTransactionSettings.ts && echo "OK"
```

#### Failure modes
- Context access outside provider

---

### Step 46: Create TransactionSettingsPanel component

#### Goal
Port TransactionSettingsPanel with slippage presets, custom input, and deadline selector.

#### Files
- `packages/frontend-solid/src/features/tx-settings/ui/TransactionSettingsPanel.tsx` - Create SolidJS component

#### Validation
```bash
grep -q "SLIPPAGE_OPTIONS" packages/frontend-solid/src/features/tx-settings/ui/TransactionSettingsPanel.tsx && echo "OK"
```

#### Failure modes
- Input validation not working with signals

---

### Step 47: Create tx-settings feature barrel export

#### Goal
Create index.ts with all tx-settings exports.

#### Files
- `packages/frontend-solid/src/features/tx-settings/index.ts` - Create barrel export

#### Validation
```bash
grep -q "TransactionSettingsPanel" packages/frontend-solid/src/features/tx-settings/index.ts && echo "OK"
```

#### Failure modes
- Missing exports

---

## Phase 9: Layout Components

Port header, footer, and navigation.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 48: Create Header component

#### Goal
Port Header with logo, navigation links, connect button, and theme toggle.

#### Files
- `packages/frontend-solid/src/shared/layout/Header.tsx` - Create SolidJS Header

#### Validation
```bash
grep -q "ConnectButton" packages/frontend-solid/src/shared/layout/Header.tsx && echo "OK"
```

#### Failure modes
- Navigation links not working with SolidJS router

---

### Step 49: Create Footer component

#### Goal
Port Footer with links, social icons, and copyright.

#### Files
- `packages/frontend-solid/src/shared/layout/Footer.tsx` - Create SolidJS Footer

#### Validation
```bash
grep -q "footer" packages/frontend-solid/src/shared/layout/Footer.tsx && echo "OK"
```

#### Failure modes
- Static content should work unchanged

---

### Step 50: Create MobileNav component

#### Goal
Port MobileNav with bottom navigation for mobile devices.

#### Files
- `packages/frontend-solid/src/shared/layout/MobileNav.tsx` - Create SolidJS MobileNav

#### Validation
```bash
grep -q "MobileNav" packages/frontend-solid/src/shared/layout/MobileNav.tsx && echo "OK"
```

#### Failure modes
- Active route detection not working

---

### Step 51: Create ThemeToggle component

#### Goal
Port ThemeToggle button with icon transition.

#### Files
- `packages/frontend-solid/src/shared/layout/ThemeToggle.tsx` - Create SolidJS ThemeToggle

#### Validation
```bash
grep -q "useTheme" packages/frontend-solid/src/shared/layout/ThemeToggle.tsx && echo "OK"
```

#### Failure modes
- Theme context not accessible

---

### Step 52: Create layout barrel export

#### Goal
Create index.ts with all layout exports.

#### Files
- `packages/frontend-solid/src/shared/layout/index.ts` - Create barrel export

#### Validation
```bash
grep -q "Header" packages/frontend-solid/src/shared/layout/index.ts && echo "OK"
```

#### Failure modes
- Missing exports

---

## Phase 10: Route Pages

Create Solid Start file-based routes.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 53: Create home page route

#### Goal
Create index route (/) with hero section and market list.

#### Files
- `packages/frontend-solid/src/routes/index.tsx` - Create home page

#### Validation
```bash
grep -q "export default" packages/frontend-solid/src/routes/index.tsx && echo "OK"
```

#### Failure modes
- Route not rendering

---

### Step 54: Create trade page route

#### Goal
Create /trade route with SwapForm and market selection.

#### Files
- `packages/frontend-solid/src/routes/trade.tsx` - Create trade page

#### Validation
```bash
grep -q "SwapForm" packages/frontend-solid/src/routes/trade.tsx && echo "OK"
```

#### Failure modes
- Market selection not persisting across navigation

---

### Step 55: Create mint page route

#### Goal
Create /mint route with mint form.

#### Files
- `packages/frontend-solid/src/routes/mint.tsx` - Create mint page

#### Validation
```bash
grep -q "export default" packages/frontend-solid/src/routes/mint.tsx && echo "OK"
```

#### Failure modes
- Route not rendering

---

### Step 56: Create pools page route

#### Goal
Create /pools route with liquidity forms.

#### Files
- `packages/frontend-solid/src/routes/pools.tsx` - Create pools page

#### Validation
```bash
grep -q "export default" packages/frontend-solid/src/routes/pools.tsx && echo "OK"
```

#### Failure modes
- Route not rendering

---

### Step 57: Create portfolio page route

#### Goal
Create /portfolio route with user positions.

#### Files
- `packages/frontend-solid/src/routes/portfolio.tsx` - Create portfolio page

#### Validation
```bash
grep -q "export default" packages/frontend-solid/src/routes/portfolio.tsx && echo "OK"
```

#### Failure modes
- Route not rendering

---

### Step 58: Create analytics page route

#### Goal
Create /analytics route with protocol stats.

#### Files
- `packages/frontend-solid/src/routes/analytics.tsx` - Create analytics page

#### Validation
```bash
grep -q "export default" packages/frontend-solid/src/routes/analytics.tsx && echo "OK"
```

#### Failure modes
- Route not rendering

---

### Step 59: Create faucet page route

#### Goal
Create /faucet route with token faucet form.

#### Files
- `packages/frontend-solid/src/routes/faucet.tsx` - Create faucet page

#### Validation
```bash
grep -q "export default" packages/frontend-solid/src/routes/faucet.tsx && echo "OK"
```

#### Failure modes
- Route not rendering

---

## Phase 11: API Routes

Create server-side API endpoints.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 60: Create RPC proxy route

#### Goal
Create /api/rpc route that proxies Starknet RPC calls, keeping API keys server-side.

#### Files
- `packages/frontend-solid/src/routes/api/rpc.ts` - Create RPC proxy

#### Validation
```bash
grep -q "POST" packages/frontend-solid/src/routes/api/rpc.ts && echo "OK"
```

#### Failure modes
- Request body parsing issues in Solid Start

---

### Step 61: Create markets API routes

#### Goal
Create /api/markets and /api/markets/[address] routes.

#### Files
- `packages/frontend-solid/src/routes/api/markets/index.ts` - Create markets list route
- `packages/frontend-solid/src/routes/api/markets/[address].ts` - Create single market route

#### Validation
```bash
grep -q "GET" packages/frontend-solid/src/routes/api/markets/index.ts && echo "OK"
```

#### Failure modes
- Dynamic route parameters not working

---

### Step 62: Create health check route

#### Goal
Create /api/health route for monitoring.

#### Files
- `packages/frontend-solid/src/routes/api/health.ts` - Create health check route

#### Validation
```bash
grep -q "GET" packages/frontend-solid/src/routes/api/health.ts && echo "OK"
```

#### Failure modes
- Route not responding

---

## Phase 12: Additional Features

Port remaining features.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 63: Create mint feature

#### Goal
Port useMint hook and MintForm component.

#### Files
- `packages/frontend-solid/src/features/mint/model/useMint.ts` - Create useMint hook
- `packages/frontend-solid/src/features/mint/ui/MintForm.tsx` - Create MintForm component
- `packages/frontend-solid/src/features/mint/index.ts` - Create barrel export

#### Validation
```bash
grep -q "createMutation" packages/frontend-solid/src/features/mint/model/useMint.ts && echo "OK"
```

#### Failure modes
- Mutation not executing

---

### Step 64: Create liquidity feature

#### Goal
Port useLiquidity, AddLiquidityForm, RemoveLiquidityForm.

#### Files
- `packages/frontend-solid/src/features/liquidity/model/useLiquidity.ts` - Create useLiquidity hook
- `packages/frontend-solid/src/features/liquidity/ui/AddLiquidityForm.tsx` - Create AddLiquidityForm
- `packages/frontend-solid/src/features/liquidity/ui/RemoveLiquidityForm.tsx` - Create RemoveLiquidityForm
- `packages/frontend-solid/src/features/liquidity/index.ts` - Create barrel export

#### Validation
```bash
grep -q "createMutation" packages/frontend-solid/src/features/liquidity/model/useLiquidity.ts && echo "OK"
```

#### Failure modes
- Form state management issues

---

### Step 65: Create yield feature

#### Goal
Port yield calculation hooks (useYield, useApyBreakdown, useUserYield).

#### Files
- `packages/frontend-solid/src/features/yield/model/useYield.ts` - Create useYield hook
- `packages/frontend-solid/src/features/yield/model/useApyBreakdown.ts` - Create useApyBreakdown hook
- `packages/frontend-solid/src/features/yield/model/useUserYield.ts` - Create useUserYield hook
- `packages/frontend-solid/src/features/yield/ui/ApyBreakdown.tsx` - Create ApyBreakdown component
- `packages/frontend-solid/src/features/yield/index.ts` - Create barrel export

#### Validation
```bash
grep -q "createQuery" packages/frontend-solid/src/features/yield/model/useYield.ts && echo "OK"
```

#### Failure modes
- Yield calculations incorrect

---

### Step 66: Create portfolio feature

#### Goal
Port usePortfolio, usePositions hooks and position display components.

#### Files
- `packages/frontend-solid/src/features/portfolio/model/usePortfolio.ts` - Create usePortfolio hook
- `packages/frontend-solid/src/features/portfolio/model/usePositions.ts` - Create usePositions hook
- `packages/frontend-solid/src/features/portfolio/index.ts` - Create barrel export

#### Validation
```bash
grep -q "createQuery" packages/frontend-solid/src/features/portfolio/model/usePortfolio.ts && echo "OK"
```

#### Failure modes
- Position data not loading

---

### Step 67: Create faucet feature

#### Goal
Port useFaucet mutation hook and FaucetForm component.

#### Files
- `packages/frontend-solid/src/features/faucet/model/useFaucet.ts` - Create useFaucet hook
- `packages/frontend-solid/src/features/faucet/ui/FaucetForm.tsx` - Create FaucetForm component
- `packages/frontend-solid/src/features/faucet/index.ts` - Create barrel export

#### Validation
```bash
grep -q "createMutation" packages/frontend-solid/src/features/faucet/model/useFaucet.ts && echo "OK"
```

#### Failure modes
- Faucet request not executing

---

## Phase 13: Entity Components

Port domain entity components.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 68: Create market entity components

#### Goal
Port MarketCard, MarketList, AssetTypeBadge, StatsOverview.

#### Files
- `packages/frontend-solid/src/entities/market/ui/MarketCard.tsx` - Create MarketCard
- `packages/frontend-solid/src/entities/market/ui/MarketList.tsx` - Create MarketList
- `packages/frontend-solid/src/entities/market/ui/AssetTypeBadge.tsx` - Create AssetTypeBadge
- `packages/frontend-solid/src/entities/market/ui/StatsOverview.tsx` - Create StatsOverview
- `packages/frontend-solid/src/entities/market/model/types.ts` - Copy types
- `packages/frontend-solid/src/entities/market/index.ts` - Create barrel export

#### Validation
```bash
grep -q "MarketCard" packages/frontend-solid/src/entities/market/index.ts && echo "OK"
```

#### Failure modes
- Card rendering issues

---

### Step 69: Create position entity components

#### Goal
Port EnhancedPositionCard, SummaryCard, PnL calculations.

#### Files
- `packages/frontend-solid/src/entities/position/ui/EnhancedPositionCard.tsx` - Create PositionCard
- `packages/frontend-solid/src/entities/position/ui/SummaryCard.tsx` - Create SummaryCard
- `packages/frontend-solid/src/entities/position/lib/pnl.ts` - Copy PnL calculations
- `packages/frontend-solid/src/entities/position/lib/value.ts` - Copy value calculations
- `packages/frontend-solid/src/entities/position/model/types.ts` - Copy types
- `packages/frontend-solid/src/entities/position/index.ts` - Create barrel export

#### Validation
```bash
grep -q "EnhancedPositionCard" packages/frontend-solid/src/entities/position/index.ts && echo "OK"
```

#### Failure modes
- PnL calculations incorrect

---

### Step 70: Create token entity components

#### Goal
Port TokenAmount display component.

#### Files
- `packages/frontend-solid/src/entities/token/ui/TokenAmount.tsx` - Create TokenAmount
- `packages/frontend-solid/src/entities/token/model/types.ts` - Copy types
- `packages/frontend-solid/src/entities/token/index.ts` - Create barrel export

#### Validation
```bash
grep -q "TokenAmount" packages/frontend-solid/src/entities/token/index.ts && echo "OK"
```

#### Failure modes
- Amount formatting issues

---

## Phase 14: Widgets

Port page-level compositions.

### Phase Validation
```bash
cd packages/frontend-solid && bun run build
```

### Step 71: Create hero widget

#### Goal
Port HeroSection with animated stats and call-to-action.

#### Files
- `packages/frontend-solid/src/widgets/hero/HeroSection.tsx` - Create HeroSection

#### Validation
```bash
grep -q "HeroSection" packages/frontend-solid/src/widgets/hero/HeroSection.tsx && echo "OK"
```

#### Failure modes
- Animation not working

---

### Step 72: Create analytics widgets

#### Goal
Port key analytics widgets (TvlChart, VolumeChart, ProtocolStats).

#### Files
- `packages/frontend-solid/src/widgets/analytics/TvlChart.tsx` - Create TvlChart
- `packages/frontend-solid/src/widgets/analytics/VolumeChart.tsx` - Create VolumeChart
- `packages/frontend-solid/src/widgets/analytics/ProtocolStats.tsx` - Create ProtocolStats
- `packages/frontend-solid/src/widgets/analytics/index.ts` - Create barrel export

#### Validation
```bash
grep -q "TvlChart" packages/frontend-solid/src/widgets/analytics/index.ts && echo "OK"
```

#### Failure modes
- Chart library compatibility (recharts → solid-chartjs)

---

### Step 73: Create portfolio widgets

#### Goal
Port portfolio widgets (PositionPnlTimeline, PortfolioValueChart).

#### Files
- `packages/frontend-solid/src/widgets/portfolio/PositionPnlTimeline.tsx` - Create PositionPnlTimeline
- `packages/frontend-solid/src/widgets/portfolio/PortfolioValueChart.tsx` - Create PortfolioValueChart
- `packages/frontend-solid/src/widgets/portfolio/index.ts` - Create barrel export

#### Validation
```bash
grep -q "PositionPnlTimeline" packages/frontend-solid/src/widgets/portfolio/index.ts && echo "OK"
```

#### Failure modes
- Chart rendering issues

---

## Phase 15: Testing & Polish

Add tests and final polish.

### Phase Validation
```bash
cd packages/frontend-solid && bun run test && bun run build
```

### Step 74: Create test setup

#### Goal
Set up testing infrastructure with Vitest and @solidjs/testing-library.

#### Files
- `packages/frontend-solid/vitest.config.ts` - Create Vitest configuration
- `packages/frontend-solid/src/test/setup.ts` - Create test setup

#### Validation
```bash
grep -q "vitest" packages/frontend-solid/vitest.config.ts && echo "OK"
```

#### Failure modes
- SolidJS testing library configuration issues

---

### Step 75: Create unit tests for math utilities

#### Goal
Create unit tests for WAD math functions.

#### Files
- `packages/frontend-solid/src/shared/math/wad.test.ts` - Create WAD math tests

#### Validation
```bash
cd packages/frontend-solid && bun run test src/shared/math/wad.test.ts
```

#### Failure modes
- Test assertions failing

---

### Step 76: Create integration tests for providers

#### Goal
Create tests verifying provider composition works correctly.

#### Files
- `packages/frontend-solid/src/providers/providers.test.tsx` - Create provider tests

#### Validation
```bash
cd packages/frontend-solid && bun run test src/providers/providers.test.tsx
```

#### Failure modes
- Provider context not accessible in tests

---

### Step 77: Create E2E test configuration

#### Goal
Set up Playwright for end-to-end testing.

#### Files
- `packages/frontend-solid/playwright.config.ts` - Create Playwright configuration
- `packages/frontend-solid/tests/e2e/home.spec.ts` - Create home page E2E test

#### Validation
```bash
cd packages/frontend-solid && bun run test:e2e tests/e2e/home.spec.ts
```

#### Failure modes
- Playwright not connecting to dev server

---

### Step 78: Add npm scripts

#### Goal
Add all npm scripts matching React frontend (dev, build, check, test, test:e2e).

#### Files
- `packages/frontend-solid/package.json` - Update scripts section

#### Validation
```bash
cd packages/frontend-solid && bun run check
```

#### Failure modes
- Script commands incorrect

---

### Step 79: Create biome.json for linting

#### Goal
Set up Biome linter matching React frontend configuration.

#### Files
- `packages/frontend-solid/biome.json` - Create Biome configuration

#### Validation
```bash
cd packages/frontend-solid && bun run lint
```

#### Failure modes
- Biome configuration errors

---

### Step 80: Final build and bundle analysis

#### Goal
Run final production build and verify bundle size is smaller than React version.

#### Files
- No new files

#### Validation
```bash
cd packages/frontend-solid && bun run build && du -sh .output
```

#### Failure modes
- Build errors
- Bundle size larger than React version

---
