# SolidJS Frontend Port - Research Document

## Project Goal
Create a 1:1 port of the Horizon Protocol React frontend to SolidJS, optimized for speed and reactiveness.

---

## Part 1: React Frontend Truth (Authoritative Analysis)

### Architecture: Feature-Sliced Design (FSD)

```
src/
├── app/              # Next.js App Router pages & API routes
├── providers/        # React context providers (5 providers)
├── widgets/          # Page-level compositions
├── features/         # 18 feature modules (FSD pattern)
│   └── [feature]/
│       ├── api/      # Contract calls
│       ├── model/    # Hooks (useQuery, useMutation)
│       └── ui/       # Components
├── entities/         # Domain concepts (market, position, token)
├── shared/           # Business-logic-free utilities
│   ├── ui/           # 31 shadcn/ui components
│   ├── math/         # WAD fixed-point math
│   ├── starknet/     # Contract interactions
│   ├── config/       # Network addresses
│   └── server/       # Server-only (Drizzle ORM, rate-limit)
└── types/generated/  # ABI-generated contract types
```

### Core Dependencies (Must Port)

| Library | Purpose | SolidJS Equivalent |
|---------|---------|-------------------|
| `react@19` | UI framework | `solid-js` |
| `next@16` | Full-stack framework | `@solidjs/start` (Solid Start) |
| `@tanstack/react-query@5` | Server state | `@tanstack/solid-query` |
| `next-themes@0.4` | Dark mode | Custom signals + CSS variables |
| `starknet@9` | Blockchain | Same (framework-agnostic) |
| `@radix-ui/*` | UI primitives | `@kobalte/core` |
| `shadcn/ui` | Component library | `solid-ui` or custom components |
| `tailwindcss@4` | Styling | Same (CSS framework) |
| `sonner` | Toast notifications | `@kobalte/core` Toast |
| `recharts` | Charts | `solid-chartjs` or `@thisbeyond/solid-chart` |
| `drizzle-orm` | Database ORM | Same (server-side only) |

### Provider Hierarchy (5 Layers)

```tsx
<ThemeProvider>           → Custom SolidJS context
  <QueryProvider>         → @tanstack/solid-query
    <StarknetProvider>    → Custom SolidJS context
      <UIModeProvider>    → Custom SolidJS context
        <TransactionSettingsProvider>
          {children}
```

### State Management Patterns

1. **Theme**: `next-themes` → CSS variables + `createSignal`
2. **Server State**: TanStack Query → `@tanstack/solid-query` (same API)
3. **Wallet State**: React Context → SolidJS Context with signals
4. **UI Mode**: React Context → SolidJS Context
5. **Transaction Settings**: React Context → SolidJS Context

### Key User Routes

| Route | Description | Components |
|-------|-------------|------------|
| `/` | Home + markets | Hero, MarketList |
| `/trade` | PT/YT swap | SwapForm, TokenSelect |
| `/mint` | Mint PT+YT | MintForm |
| `/pools` | Liquidity provision | LiquidityForm |
| `/portfolio` | User positions | PositionList, ClaimYield |
| `/analytics` | Protocol metrics | Charts, Stats |
| `/faucet` | Testnet tokens | FaucetForm |
| `/docs/*` | MDX documentation | MDXRenderer |

### API Routes (30+ endpoints)

All server-side API routes live in `src/app/api/`:
- `GET /api/markets` - Market list with filters
- `GET /api/markets/[address]/*` - Market details, rates, TVL
- `GET /api/users/[address]/*` - Positions, history, yields
- `GET /api/analytics/*` - Protocol stats
- `POST /api/rpc` - RPC proxy (keeps API keys server-side)

### 18 Feature Modules

| Feature | Hooks | Key Components |
|---------|-------|----------------|
| `analytics` | useAnalytics | StatsCard, Charts |
| `earn` | useEarnStrategies | StrategyCard |
| `faucet` | useFaucet | FaucetForm |
| `liquidity` | useLiquidity | LiquidityForm |
| `markets` | useMarkets, useMarket | MarketCard, MarketList |
| `mint` | useMint | MintForm |
| `oracle` | useOracle | OracleDisplay |
| `portfolio` | usePortfolio | PositionCard |
| `price` | usePrice | PriceDisplay |
| `redeem` | useRedeem | RedeemForm |
| `rewards` | useRewards | RewardsList |
| `swap` | useSwap | SwapForm |
| `tx-settings` | useTxSettings | SettingsDialog |
| `wallet` | useAccount, useStarknet | ConnectButton |
| `yield` | useYield | YieldBreakdown |

### Styling Architecture

- **Framework**: Tailwind CSS 4
- **Colors**: OKLCH color system with CSS variables
- **Components**: shadcn/ui (Radix + Tailwind)
- **Variants**: Class Variance Authority (CVA)
- **Dark Mode**: CSS class-based (`.dark`)

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0.005 285.823);
  --primary: oklch(0.646 0.222 41.116);
}
.dark {
  --background: oklch(0.08 0.002 286);
  --foreground: oklch(0.96 0.004 286);
}
```

---

## Part 2: SolidJS Patterns (From Documentation)

### Core Reactivity Primitives

```tsx
// Signal (simple state)
const [count, setCount] = createSignal(0);
count();  // READ - must call as function!
setCount(5);  // WRITE

// Store (complex nested state)
const [store, setStore] = createStore({ user: { name: "John" } });
setStore("user", "name", "Jane");  // Path syntax

// Memo (derived values)
const doubled = createMemo(() => count() * 2);

// Effect (side effects)
createEffect(() => {
  console.log(count());  // Auto-tracks dependencies
  onCleanup(() => cleanup());
});
```

### Critical Rules

1. **Always call signals as functions**: `count()` not `count`
2. **Never destructure props**: Use `props.name` not `{ name }`
3. **Components run ONCE**: Only reactive expressions update
4. **Use control flow components**: `<Show>`, `<For>`, `<Switch>`

### Control Flow Components

```tsx
// Conditional
<Show when={user()} fallback={<Login />}>
  {(user) => <Profile user={user} />}
</Show>

// Lists (For = value, Index = signal)
<For each={items()}>{(item) => <Item data={item} />}</For>

// Multiple conditions
<Switch fallback={<Default />}>
  <Match when={loading()}><Loading /></Match>
  <Match when={error()}><Error /></Match>
</Switch>

// Async
<Suspense fallback={<Loading />}>
  <AsyncComponent />
</Suspense>
```

### Props Handling

```tsx
// WRONG - breaks reactivity
function Bad({ name }) { return <div>{name}</div>; }

// CORRECT - reactive
function Good(props) { return <div>{props.name}</div>; }

// Extract specific props
const [local, others] = splitProps(props, ["class", "onClick"]);

// Merge defaults
const merged = mergeProps({ disabled: false }, props);
```

### Data Fetching

```tsx
// createResource - async data
const [data] = createResource(userId, async (id) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
});

// In Solid Start
const getData = query(async () => {
  "use server";
  return await db.findMany();
}, "data");

const data = createAsync(() => getData());
```

---

## Part 3: Migration Mapping

### React → SolidJS Patterns

| React | SolidJS |
|-------|---------|
| `useState(0)` | `createSignal(0)` |
| `useEffect(() => {}, [deps])` | `createEffect(() => {})` |
| `useMemo(() => x, [deps])` | `createMemo(() => x)` |
| `useCallback(fn, [deps])` | Just use `fn` (stable in Solid) |
| `useRef(null)` | `let ref;` + `ref={el => ref = el}` |
| `useContext(Ctx)` | `useContext(Ctx)` |
| `{condition && <X />}` | `<Show when={condition}><X /></Show>` |
| `items.map(...)` | `<For each={items()}>...</For>` |

### Provider Migration

```tsx
// React
function StarknetProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  return (
    <StarknetContext.Provider value={{ wallet, setWallet }}>
      {children}
    </StarknetContext.Provider>
  );
}

// SolidJS
function StarknetProvider(props) {
  const [wallet, setWallet] = createSignal(null);
  return (
    <StarknetContext.Provider value={{ wallet, setWallet }}>
      {props.children}
    </StarknetContext.Provider>
  );
}
```

### TanStack Query Migration

```tsx
// React
const { data, isLoading } = useQuery({
  queryKey: ['market', address],
  queryFn: () => fetchMarket(address),
});

// SolidJS (nearly identical!)
const query = createQuery(() => ({
  queryKey: ['market', address()],
  queryFn: () => fetchMarket(address()),
}));
// Access: query.data, query.isLoading
```

### Mutation Migration

```tsx
// React
const mutation = useMutation({
  mutationFn: async (params) => { ... },
  onSuccess: () => queryClient.invalidateQueries(['markets']),
});

// SolidJS (nearly identical!)
const mutation = createMutation(() => ({
  mutationFn: async (params) => { ... },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['markets'] }),
}));
```

---

## Part 4: Project Structure

### Recommended SolidJS Structure

```
packages/frontend-solid/
├── src/
│   ├── routes/           # File-based routing (Solid Start)
│   │   ├── index.tsx     # /
│   │   ├── trade.tsx     # /trade
│   │   ├── mint.tsx      # /mint
│   │   ├── pools.tsx     # /pools
│   │   ├── portfolio.tsx # /portfolio
│   │   ├── analytics.tsx # /analytics
│   │   ├── faucet.tsx    # /faucet
│   │   ├── docs/         # MDX docs
│   │   └── api/          # API routes
│   │       └── [...path].ts
│   │
│   ├── providers/        # SolidJS context providers
│   │   ├── index.tsx
│   │   ├── starknet.tsx
│   │   ├── query.tsx
│   │   └── theme.tsx
│   │
│   ├── features/         # FSD features (same structure!)
│   │   ├── swap/
│   │   │   ├── api/
│   │   │   ├── model/
│   │   │   └── ui/
│   │   └── [other features...]
│   │
│   ├── shared/           # Shared utilities
│   │   ├── ui/           # UI components (Kobalte-based)
│   │   ├── math/         # Pure functions (copy as-is)
│   │   ├── starknet/     # Contract utils (copy as-is)
│   │   └── config/       # Addresses (copy as-is)
│   │
│   └── types/            # Generated contract types
│
├── app.config.ts         # Solid Start config
├── tailwind.config.ts    # Tailwind config
├── package.json
└── tsconfig.json
```

### What Transfers Directly (No Changes)

- `shared/math/*` - Pure math functions
- `shared/config/*` - Network addresses, constants
- `shared/starknet/contracts.ts` - Contract factories
- `types/generated/*` - ABI types
- `tailwind.config.ts` - Styling config
- `globals.css` - CSS variables and base styles

### What Needs Rewrite

- All React components → SolidJS components
- All hooks using useState/useEffect → signals/effects
- Context providers → SolidJS context
- TanStack Query hooks → @tanstack/solid-query
- shadcn/ui components → Kobalte-based equivalents

---

## Part 5: Component Library Strategy

### Option A: Use Kobalte (Recommended)

[Kobalte](https://kobalte.dev) is the SolidJS equivalent of Radix UI:
- Unstyled, accessible components
- Same API patterns as Radix
- Works with Tailwind

```bash
npm install @kobalte/core
```

Components to port from shadcn/ui to Kobalte:
- Button → Kobalte Button
- Dialog → Kobalte Dialog
- Dropdown → Kobalte DropdownMenu
- Select → Kobalte Select
- Tabs → Kobalte Tabs
- Toast → Kobalte Toast
- Collapsible → Kobalte Collapsible

### Option B: Port shadcn/ui Components

Manually port each shadcn/ui component:
1. Keep Tailwind classes identical
2. Replace Radix primitives with Kobalte
3. Update React patterns to SolidJS

### Shared UI Component List (31 components)

Priority order for porting:
1. **Critical**: Button, Input, Card, Badge, Skeleton
2. **Forms**: Select, Slider, Switch, Toggle, Label
3. **Dialogs**: Dialog, Dropdown, HoverCard
4. **Layout**: Tabs, Collapsible, Separator
5. **Feedback**: Toast, Progress

---

## Part 6: Performance Optimizations

### SolidJS Advantages (Built-in)

1. **Fine-grained reactivity**: Only changed DOM nodes update
2. **No Virtual DOM**: Direct DOM manipulation
3. **12KB bundle** vs React's 43KB
4. **Automatic batching**: No manual optimization needed
5. **No re-renders**: Components execute once

### Additional Optimizations

```tsx
// Memoize expensive computations
const filtered = createMemo(() =>
  items().filter(item => expensiveCheck(item))
);

// Efficient list selection
const isSelected = createSelector(selectedId);
<For each={items()}>
  {(item) => <Item selected={isSelected(item.id)} />}
</For>

// Lazy loading
const Heavy = lazy(() => import("./Heavy"));
<Suspense fallback={<Loading />}>
  <Heavy />
</Suspense>

// Deferred updates for heavy operations
const deferred = createDeferred(input, { timeoutMs: 300 });
```

---

## Part 7: Implementation Plan

### Phase 1: Project Setup
1. Create Solid Start project with Tailwind
2. Copy shared utilities (math, config, starknet)
3. Set up path aliases matching React project
4. Configure TypeScript strictly
5. Generate contract types from ABIs

### Phase 2: Core Infrastructure
1. Port StarknetProvider (wallet connection)
2. Port QueryProvider (TanStack Solid Query)
3. Port ThemeProvider (dark mode)
4. Set up API routes proxy

### Phase 3: Shared UI Components
1. Port Button, Input, Card (Kobalte-based)
2. Port Dialog, Select, Dropdown
3. Port remaining 25 components
4. Ensure identical styling

### Phase 4: Feature Modules
1. Port wallet feature (connect/disconnect)
2. Port markets feature (list, details)
3. Port swap feature (trading)
4. Port mint feature
5. Port liquidity feature
6. Port portfolio feature
7. Port analytics feature
8. Port remaining features

### Phase 5: Routes & Pages
1. Create route structure
2. Port each page component
3. Wire up data loading
4. Test navigation

### Phase 6: Testing & Polish
1. E2E tests with Playwright
2. Performance benchmarking
3. Bundle size analysis
4. Final styling review

---

## Part 8: Critical Decisions

### 1. Framework Choice
**Decision**: Use Solid Start (not plain SolidJS)
- Provides SSR support
- File-based routing
- API routes
- Server functions

### 2. Routing
**Decision**: @solidjs/router via Solid Start
- File-based routing in `src/routes/`
- Matches Next.js mental model

### 3. State Management
**Decision**: @tanstack/solid-query + Context
- Minimal learning curve (same API as React)
- Proven patterns from existing codebase

### 4. Component Library
**Decision**: Kobalte + custom Tailwind styling
- Matches Radix patterns
- Allows identical styling
- Production-ready accessibility

### 5. Styling
**Decision**: Keep Tailwind CSS 4 + CVA
- No changes needed
- Copy globals.css directly
- Same class names work

---

## Part 9: Risk Assessment

### Low Risk
- Pure utility functions (math, config) - copy directly
- Tailwind styling - works unchanged
- Contract types - regenerate same way
- API route logic - mostly framework-agnostic

### Medium Risk
- TanStack Query migration - API similar but different imports
- Context providers - different patterns
- Form handling - different event model

### High Risk
- shadcn/ui → Kobalte component parity
- MDX documentation pages
- Wallet connection patterns (untested in SolidJS)
- Chart library compatibility

---

## Part 10: Validation Checklist

Before implementation:
- [ ] Solid Start project builds
- [ ] Tailwind CSS works with theme
- [ ] Kobalte components render correctly
- [ ] starknet.js works in SolidJS
- [ ] @tanstack/solid-query connects to API
- [ ] Wallet connection flow works

During implementation:
- [ ] Each feature module passes tests
- [ ] UI matches React version pixel-for-pixel
- [ ] All routes render correctly
- [ ] Data fetching works
- [ ] Mutations execute properly

After implementation:
- [ ] Bundle size < React version
- [ ] Performance benchmarks pass
- [ ] E2E tests pass
- [ ] Manual QA complete

---

## References

### React Frontend Files (Authoritative)
- `packages/frontend/src/providers/` - Provider implementations
- `packages/frontend/src/features/*/model/` - Hook patterns
- `packages/frontend/src/shared/ui/` - Component implementations
- `packages/frontend/src/app/globals.css` - Styling variables

### SolidJS Documentation
- `/home/ametel/source/solid-docs/AGENTS/` - Complete SolidJS docs
- Core reactivity: chunks 002-009
- Routing: chunks 014-016
- Solid Start: chunks 017-020

### External Resources
- Kobalte: https://kobalte.dev
- TanStack Solid Query: https://tanstack.com/query/latest/docs/solid/overview
- Solid Start: https://start.solidjs.com
