/**
 * Shared chart theme configuration
 * Provides consistent styling across all Recharts visualizations
 */

export const chartTheme = {
  colors: {
    primary: 'oklch(0.705 0.213 47.604)',
    secondary: 'oklch(0.837 0.128 66.29)',
    success: 'oklch(0.723 0.191 142.5)',
    danger: 'oklch(0.577 0.245 27.325)',
    warning: 'oklch(0.795 0.184 86.047)',
    grid: 'oklch(1 0 0 / 5%)',
    gridDark: 'oklch(1 0 0 / 8%)',
    axis: 'oklch(1 0 0 / 10%)',
    reference: 'oklch(1 0 0 / 20%)',
  },

  gradients: {
    area: {
      primary: [
        { offset: '0%', opacity: 0.4 },
        { offset: '100%', opacity: 0 },
      ],
      secondary: [
        { offset: '0%', opacity: 0.3 },
        { offset: '100%', opacity: 0 },
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
    label: {
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
      fill: 'var(--foreground)',
    },
  },

  animation: {
    duration: 800,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },

  stroke: {
    width: {
      thin: 1,
      default: 2,
      thick: 3,
    },
    dasharray: {
      dashed: '2 4',
      dotted: '1 3',
      reference: '4 4',
    },
  },

  dot: {
    default: {
      r: 4,
      strokeWidth: 2,
    },
    active: {
      r: 6,
      strokeWidth: 2,
    },
  },
} as const;

/**
 * CSS variable-based colors for use in Recharts
 * Use these when you need CSS variable resolution
 */
export const chartColors = {
  chart1: 'var(--chart-1)',
  chart2: 'var(--chart-2)',
  chart3: 'var(--chart-3)',
  chart4: 'var(--chart-4)',
  chart5: 'var(--chart-5)',
  primary: 'var(--primary)',
  destructive: 'var(--destructive)',
  warning: 'var(--warning)',
  muted: 'var(--muted-foreground)',
} as const;

/**
 * Generate a gradient ID unique to each chart instance
 */
export function generateGradientId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Common CartesianGrid props
 */
export const gridProps = {
  strokeDasharray: chartTheme.stroke.dasharray.dashed,
  stroke: chartTheme.colors.gridDark,
  vertical: false,
} as const;

/**
 * Common XAxis props
 */
export const xAxisProps = {
  tick: chartTheme.typography.axis,
  tickLine: false,
  axisLine: { stroke: chartTheme.colors.axis },
} as const;

/**
 * Common YAxis props
 */
export const yAxisProps = {
  tick: chartTheme.typography.axis,
  tickLine: false,
  axisLine: false,
} as const;
