# Horizon Protocol: 2026 DeFi Frontend Redesign Proposal

## Executive Summary

This document proposes a comprehensive visual redesign for Horizon Protocol, transforming it from a functional DeFi interface into a distinctive, memorable experience while maintaining shadcn/ui components and the existing color system.

---

## Part 1: Current State Analysis

### Strengths
- **Solid Architecture**: Feature-Sliced Design provides excellent maintainability
- **Component Library**: shadcn/ui provides accessible, customizable components
- **Color System**: Warm amber/orange palette (oklch hue 41-47) differentiates from typical DeFi blues
- **Dual Mode**: Simple/Advanced toggle is excellent UX for different user segments
- **Performance**: Dynamic imports for charts, optimized bundle splitting

### Areas for Improvement

| Aspect | Current State | Opportunity |
|--------|--------------|-------------|
| Typography | Public Sans / Inter (safe, generic) | Distinctive display + refined body fonts |
| Layouts | Standard card grids | Asymmetric, dynamic compositions |
| Data Viz | Basic Recharts with default styling | Custom-designed, branded visualizations |
| Motion | Minimal transitions | Purposeful micro-interactions |
| Visual Depth | Flat cards with subtle borders | Layered atmospherics, shadows, gradients |
| Hero/Landing | Basic text + stats | Immersive, memorable first impression |

---

## Part 2: Design Philosophy

### Aesthetic Direction: "Horizon Dusk"

**Concept**: A **warm, sophisticated, terminal-inspired** aesthetic that evokes the horizon at golden hour. This positions Horizon as a premium, professional yield protocol while maintaining approachability.

**Key Attributes**:
- **Warm Luminosity**: Amber glow effects reminiscent of sun on the horizon
- **Depth Through Layers**: Subtle gradients and shadows create visual hierarchy
- **Terminal Precision**: Monospace numbers and data-dense layouts signal expertise
- **Organic Motion**: Smooth, natural animations that feel alive

### Color Philosophy (Maintaining Existing Palette)

The existing warm orange/amber palette is already distinctive. We enhance it with:

```css
/* Enhanced semantic colors */
--glow-primary: oklch(0.705 0.213 47.604 / 15%);
--glow-success: oklch(0.723 0.191 142.5 / 15%);
--surface-elevated: oklch(0.21 0.006 285.885);
--surface-sunken: oklch(0.16 0.004 286);

/* Gradient meshes for backgrounds */
--gradient-horizon: radial-gradient(
  ellipse 80% 50% at 50% 100%,
  oklch(0.705 0.213 47.604 / 8%) 0%,
  transparent 70%
);
```

---

## Part 3: Typography System

### Current
- Display: Public Sans (safe, common)
- Body: Inter (ubiquitous)
- Mono: JetBrains Mono (good choice)

### Proposed Typography Stack

```typescript
// src/app/layout.tsx - Updated font configuration
import { Instrument_Serif, Outfit, JetBrains_Mono } from 'next/font/google';

// Display: Instrument Serif - Elegant, distinctive headlines
const displayFont = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

// Body: Outfit - Modern geometric sans, excellent readability
const bodyFont = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Mono: Keep JetBrains Mono - Perfect for numbers/data
const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
```

### Typography Scale

```css
/* Enhanced typography in globals.css */
@layer base {
  h1, .h1 {
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 400;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  h2, .h2 {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 3vw, 2.25rem);
    font-weight: 400;
    letter-spacing: -0.01em;
  }

  /* Data-dense numbers */
  .metric {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  /* APY/Rate displays - extra prominence */
  .metric-hero {
    font-family: var(--font-mono);
    font-size: clamp(2rem, 4vw, 3.5rem);
    font-weight: 600;
    background: linear-gradient(
      135deg,
      oklch(0.837 0.128 66.29),
      oklch(0.705 0.213 47.604)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}
```

---

## Part 4: Component Redesigns

### 4.1 Hero Section Redesign

**Current**: Basic centered text with stats grid below

**Proposed**: Immersive gradient horizon with animated glow

```tsx
// New component: src/widgets/hero/HeroSection.tsx
export function HeroSection() {
  return (
    <section className="relative min-h-[60vh] flex items-center overflow-hidden">
      {/* Background: Horizon gradient mesh */}
      <div className="absolute inset-0 bg-gradient-horizon" />
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.02]" />

      {/* Animated horizon glow */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200%] h-[50%]"
        style={{
          background: 'radial-gradient(ellipse at center bottom, oklch(0.705 0.213 47.604 / 20%), transparent 60%)',
          animation: 'pulse 8s ease-in-out infinite',
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
        <h1 className="font-display text-5xl md:text-7xl tracking-tight">
          Split Your Yield
        </h1>
        <p className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto">
          Tokenize yield-bearing assets into Principal and Yield tokens.
          Lock in fixed returns or speculate on variable rates.
        </p>

        {/* Floating stat orbs */}
        <div className="mt-16 flex justify-center gap-12">
          <StatOrb label="TVL" value="$4.2M" />
          <StatOrb label="Implied APY" value="8.4%" highlight />
          <StatOrb label="Markets" value="3" />
        </div>
      </div>
    </section>
  );
}
```

### 4.2 Market Card Redesign

**Current**: Standard card with text rows

**Proposed**: Rich, layered card with visual yield indicator

```tsx
// Enhanced MarketCard with visual hierarchy
export function MarketCard({ market }: MarketCardProps) {
  const apy = market.impliedApy.toNumber() * 100;

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
      {/* Yield intensity glow (stronger for higher APY) */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:via-transparent group-hover:to-primary/10 transition-all duration-500"
        style={{
          opacity: Math.min(apy / 20, 1), // Scales with APY up to 20%
        }}
      />

      <CardHeader className="relative pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              {/* Token icon placeholder */}
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-mono text-primary">PT</span>
              </div>
              <div>
                <span className="text-lg">PT-{tokenSymbol}</span>
                <ExpiryBadge expiryTimestamp={market.expiry} />
              </div>
            </CardTitle>
          </div>

          {/* APY Hero Display */}
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Implied APY
            </div>
            <div className="metric-hero text-3xl">
              {apy.toFixed(2)}%
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative">
        {/* Visual yield bar */}
        <div className="mb-4 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-chart-1 to-primary rounded-full transition-all duration-500"
            style={{ width: `${Math.min(apy * 5, 100)}%` }}
          />
        </div>

        {/* Compact stats grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <StatRow label="TVL" value={formatTvl(market.tvlSy)} />
          <StatRow label="Liquidity" value={formatLiquidity(market.state.syReserve)} />
          <StatRow label="Days Left" value={Math.round(market.daysToExpiry)} />
          <StatRow label="Volume 24h" value="$12.4K" />
        </div>

        {/* Action buttons with hover reveal */}
        <div className="mt-4 flex gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
          <Button asChild className="flex-1">
            <Link href={`/trade?market=${market.address}`}>
              Trade PT
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/pools?market=${market.address}`}>
              Pool
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 4.3 Swap Form Redesign

**Current**: Stacked tabs + inputs + info card

**Proposed**: Streamlined single-card with inline options and visual feedback

```tsx
// Enhanced SwapForm with visual price impact
export function SwapForm({ market }: SwapFormProps) {
  return (
    <Card className="relative overflow-hidden">
      {/* Subtle animated background based on swap direction */}
      <div className={cn(
        "absolute inset-0 transition-all duration-500",
        isBuying
          ? "bg-gradient-to-br from-primary/5 via-transparent to-transparent"
          : "bg-gradient-to-br from-destructive/5 via-transparent to-transparent"
      )} />

      <CardContent className="relative p-6 space-y-6">
        {/* Token type + direction as inline pills */}
        <div className="flex items-center gap-4">
          <ToggleGroup type="single" value={tokenType} onValueChange={setTokenType}>
            <ToggleGroupItem value="PT" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              PT
            </ToggleGroupItem>
            <ToggleGroupItem value="YT" className="data-[state=on]:bg-chart-2 data-[state=on]:text-foreground">
              YT
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex-1" />

          <ToggleGroup type="single" value={isBuying ? 'buy' : 'sell'}>
            <ToggleGroupItem value="buy" className="data-[state=on]:bg-primary/20 text-primary">
              Buy
            </ToggleGroupItem>
            <ToggleGroupItem value="sell" className="data-[state=on]:bg-destructive/20 text-destructive">
              Sell
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Input/Output with visual connection */}
        <div className="relative space-y-2">
          <TokenInputEnhanced
            label="Pay"
            token={inputToken}
            value={inputAmount}
            onChange={setInputAmount}
            balance={inputBalance}
          />

          {/* Animated swap arrow */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-background shadow-lg hover:rotate-180 transition-transform duration-300"
              onClick={toggleDirection}
            >
              <ArrowDownUp className="w-4 h-4" />
            </Button>
          </div>

          <TokenOutputEnhanced
            label="Receive"
            token={outputToken}
            value={expectedOutput}
            minValue={minOutput}
          />
        </div>

        {/* Price impact visualization */}
        <PriceImpactMeter impact={priceImpact} />

        {/* Collapsible details */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
            <span>Swap Details</span>
            <ChevronDown className="w-4 h-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-2 text-sm">
            <DetailRow label="Rate" value={`1 ${inputLabel} = ${rate} ${outputLabel}`} />
            <DetailRow label="Price Impact" value={formatPriceImpact(priceImpact)} severity={impactSeverity} />
            <DetailRow label="Implied APY" value={`${impliedApyBefore}% → ${impliedApyAfter}%`} />
            <DetailRow label="Slippage" value={slippagePercent} />
            <DetailRow label="Fee" value={formatWad(swapResult?.fee)} />
          </CollapsibleContent>
        </Collapsible>

        {/* Submit */}
        <Button className="w-full h-12 text-base font-medium" disabled={!canSwap}>
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

// Visual price impact meter
function PriceImpactMeter({ impact }: { impact: number }) {
  const severity = getPriceImpactSeverity(impact);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Price Impact</span>
        <span className={cn(
          severity === 'low' && 'text-foreground',
          severity === 'medium' && 'text-warning',
          severity === 'high' && 'text-destructive',
        )}>
          {(impact * 100).toFixed(2)}%
        </span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            severity === 'low' && 'bg-primary',
            severity === 'medium' && 'bg-warning',
            severity === 'high' && 'bg-destructive',
          )}
          style={{ width: `${Math.min(impact * 1000, 100)}%` }}
        />
      </div>
    </div>
  );
}
```

### 4.4 Analytics Dashboard Redesign

**Current**: Linear sections with collapsibles

**Proposed**: Bento grid layout with focal yield curve

```tsx
export function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Compact header */}
      <header className="mb-8">
        <h1 className="font-display text-4xl">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Yield-native protocol metrics
        </p>
      </header>

      {/* Bento grid layout */}
      <div className="grid gap-4 grid-cols-12 auto-rows-[minmax(120px,auto)]">
        {/* Hero: Yield Curve - spans 8 columns, 3 rows */}
        <div className="col-span-12 lg:col-span-8 row-span-3">
          <YieldCurveChart />
        </div>

        {/* Stats stack - 4 columns, 3 rows */}
        <div className="col-span-6 lg:col-span-4 row-span-1">
          <StatCard label="Total TVL" value="$4.2M" delta="+12.4%" />
        </div>
        <div className="col-span-6 lg:col-span-4 row-span-1">
          <StatCard label="24h Volume" value="$142K" delta="+8.2%" />
        </div>
        <div className="col-span-12 lg:col-span-4 row-span-1">
          <StatCard label="Avg Implied APY" value="8.42%" compact />
        </div>

        {/* PT Convergence - 6 columns, 2 rows */}
        <div className="col-span-12 md:col-span-6 row-span-2">
          <PtConvergenceChart />
        </div>

        {/* Implied vs Realized - 6 columns, 2 rows */}
        <div className="col-span-12 md:col-span-6 row-span-2">
          <ImpliedVsRealizedChart />
        </div>

        {/* Market Depth - Full width */}
        <div className="col-span-12 row-span-2">
          <DepthCurve />
        </div>

        {/* Liquidity Health Scores - grid of small cards */}
        <div className="col-span-12">
          <LiquidityHealthGrid />
        </div>
      </div>
    </div>
  );
}
```

---

## Part 5: Animation & Motion System

### Motion Principles
1. **Purpose over decoration**: Every animation serves UX
2. **Fast defaults, slow reveals**: 150ms interactions, 400ms reveals
3. **Natural easing**: Use cubic-bezier for organic feel
4. **Respect preferences**: Honor `prefers-reduced-motion`

### Animation Utilities

```css
/* globals.css - Motion utilities */
@layer utilities {
  .animate-fade-up {
    animation: fade-up 0.4s ease-out forwards;
  }

  .animate-glow-pulse {
    animation: glow-pulse 4s ease-in-out infinite;
  }

  .animate-number-tick {
    animation: number-tick 0.3s ease-out;
  }
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@keyframes number-tick {
  0% { transform: translateY(100%); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
```

### Staggered Reveals

```tsx
// Utility for staggered children animations
function StaggeredReveal({ children, delay = 50 }) {
  return (
    <div className="contents">
      {Children.map(children, (child, i) => (
        <div
          className="animate-fade-up"
          style={{ animationDelay: `${i * delay}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

// Usage in MarketList
<StaggeredReveal delay={100}>
  {markets.map(market => <MarketCard key={market.address} market={market} />)}
</StaggeredReveal>
```

---

## Part 6: Data Visualization Enhancements

### Chart Styling Standards

```tsx
// Shared chart theme configuration
export const chartTheme = {
  colors: {
    primary: 'oklch(0.705 0.213 47.604)',
    secondary: 'oklch(0.837 0.128 66.29)',
    success: 'oklch(0.723 0.191 142.5)',
    danger: 'oklch(0.577 0.245 27.325)',
    grid: 'oklch(1 0 0 / 5%)',
  },

  gradients: {
    area: {
      primary: [
        { offset: 0, opacity: 0.4 },
        { offset: 100, opacity: 0 },
      ],
    },
  },

  typography: {
    axis: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      fill: 'var(--muted-foreground)',
    },
    tooltip: {
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
    },
  },

  animation: {
    duration: 800,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
};
```

### Yield Curve Visualization

```tsx
// Enhanced Yield Curve with visual improvements
export function YieldCurveChart() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-xl">Term Structure</CardTitle>
          <Badge variant="outline">Live</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={curveData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
            {/* Gradient fill under curve */}
            <defs>
              <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.705 0.213 47.604)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="oklch(0.705 0.213 47.604)" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Subtle grid */}
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="oklch(1 0 0 / 8%)"
              vertical={false}
            />

            {/* Reference line at 0% */}
            <ReferenceLine y={0} stroke="oklch(1 0 0 / 20%)" strokeDasharray="4 4" />

            <XAxis
              dataKey="maturity"
              tick={{ ...chartTheme.typography.axis }}
              tickLine={false}
              axisLine={{ stroke: 'oklch(1 0 0 / 10%)' }}
            />

            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ ...chartTheme.typography.axis }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />

            {/* Area + Line for yield curve */}
            <Area
              type="monotone"
              dataKey="impliedApy"
              fill="url(#yieldGradient)"
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="impliedApy"
              stroke="oklch(0.705 0.213 47.604)"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />

            {/* Custom tooltip */}
            <Tooltip
              content={<CustomYieldTooltip />}
              cursor={{ stroke: 'oklch(1 0 0 / 20%)' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

---

## Part 7: Mobile-First Responsive Design

### Breakpoint Strategy

```css
/* Enhanced responsive utilities */
@layer utilities {
  /* Touch-friendly tap targets */
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }

  /* Mobile card padding */
  @media (max-width: 640px) {
    .card-responsive {
      @apply p-4;
    }

    .metric-responsive {
      @apply text-2xl;
    }
  }

  /* Tablet optimizations */
  @media (min-width: 641px) and (max-width: 1024px) {
    .grid-tablet-optimize {
      @apply grid-cols-2;
    }
  }
}
```

### Mobile Navigation Enhancement

```tsx
// Bottom sheet navigation for mobile
export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="bg-card/80 backdrop-blur-xl border-t border-border">
        <div className="grid grid-cols-5 gap-1 p-2">
          <NavItem href="/" icon={<Home />} label="Home" />
          <NavItem href="/trade" icon={<ArrowRightLeft />} label="Trade" />
          <NavItem href="/mint" icon={<Plus />} label="Mint" primary />
          <NavItem href="/pools" icon={<Droplets />} label="Pools" />
          <NavItem href="/portfolio" icon={<Wallet />} label="Portfolio" />
        </div>
        {/* Safe area padding for notched devices */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </nav>
  );
}
```

### Swap Form Mobile Optimization

```tsx
// Mobile-optimized token input
export function TokenInputMobile({ label, token, value, onChange, balance }) {
  return (
    <div className="bg-muted rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <button
          onClick={() => onChange(formatWad(balance))}
          className="text-xs text-primary"
        >
          Max: {formatWad(balance, 4)}
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Large, touch-friendly input */}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="flex-1 bg-transparent text-3xl font-mono outline-none placeholder:text-muted-foreground/50"
        />

        {/* Token selector button */}
        <Button variant="secondary" className="gap-2 pl-2 pr-3 h-12 rounded-full">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-mono text-primary">PT</span>
          </div>
          <span className="font-medium">{token.symbol}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
```

---

## Part 8: Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [x] Typography system update (fonts, scales, utilities)
- [x] Enhanced color tokens and gradients
- [x] Animation utilities and CSS updates
- [x] Mobile navigation component

### Phase 2: Core Components (Week 3-4)
- [x] MarketCard redesign
- [x] SwapForm enhancement
- [x] TokenInput mobile optimization
- [x] Stats cards with motion

### Phase 3: Pages (Week 5-6)
- [x] Hero section implementation
- [x] Analytics bento grid layout
- [x] Portfolio page polish
- [x] Trade page refinement

### Phase 4: Data Visualization (Week 7-8)
- [x] Yield curve chart enhancement
- [x] Price impact visualization
- [x] Sparklines and mini-charts
- [x] Loading states and skeletons

### Phase 5: Polish (Week 9-10)
- [x] Micro-interactions throughout
- [x] Accessibility audit and fixes
- [x] Performance optimization

---

## Part 9: Component Examples

### Enhanced Stat Card

```tsx
// src/shared/ui/StatCard.tsx
interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  compact?: boolean;
}

export function StatCard({ label, value, delta, trend, icon, compact }: StatCardProps) {
  return (
    <Card className={cn(
      "relative overflow-hidden group",
      compact ? "p-4" : "p-6"
    )}>
      {/* Subtle glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-transparent transition-all duration-500" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          {icon && <div className="text-primary/50">{icon}</div>}
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className={cn(
            "font-mono font-semibold tracking-tight",
            compact ? "text-2xl" : "text-3xl"
          )}>
            {value}
          </span>

          {delta && (
            <span className={cn(
              "text-sm font-medium",
              trend === 'up' && "text-green-500",
              trend === 'down' && "text-red-500",
              trend === 'neutral' && "text-muted-foreground"
            )}>
              {delta}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
```

### Enhanced Badge Variants

```tsx
// Extended badge variants for DeFi context
export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",

        // DeFi-specific variants
        success: "border-transparent bg-green-500/10 text-green-600 dark:text-green-400",
        warning: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
        live: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 animate-pulse",
        expiring: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        expired: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);
```

---

## Part 10: Accessibility Enhancements

### Focus Visible Improvements

```css
/* Enhanced focus states */
@layer base {
  :focus-visible {
    outline: 2px solid oklch(0.705 0.213 47.604);
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* High contrast focus for inputs */
  input:focus-visible,
  textarea:focus-visible {
    outline-width: 3px;
  }
}
```

### Screen Reader Utilities

```tsx
// Live region for transaction updates
export function TxStatusAnnouncer({ status, hash }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {status === 'pending' && 'Transaction pending...'}
      {status === 'success' && `Transaction confirmed: ${hash}`}
      {status === 'error' && 'Transaction failed'}
    </div>
  );
}
```

---

## Conclusion

This redesign proposal transforms Horizon Protocol's frontend from a functional DeFi interface into a distinctive, memorable experience. Key differentiators:

1. **"Horizon Dusk" aesthetic** - Warm, sophisticated, premium feel
2. **Typography excellence** - Instrument Serif + Outfit creates visual hierarchy
3. **Data-first visualization** - Charts and metrics are central, not afterthoughts
4. **Purposeful motion** - Animations that delight without overwhelming
5. **Mobile excellence** - Touch-optimized, bottom navigation, adaptive layouts

The implementation maintains shadcn/ui components, the existing color palette, and Feature-Sliced Design architecture while dramatically elevating the visual experience.

---

*Proposed by Frontend Design Analysis - December 2025*
