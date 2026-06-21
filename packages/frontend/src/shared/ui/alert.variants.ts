import { cva } from 'class-variance-authority';

/**
 * Alert variants following the project's semantic color system.
 *
 * Variants:
 * - default: Neutral information
 * - destructive: Error/danger states (semantic red)
 * - warning: Caution states (semantic amber)
 * - info: Informational states (semantic blue)
 */
export const alertVariants = cva(
  'grid gap-0.5 rounded-lg border px-4 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*="size-"])]:size-4 w-full relative group/alert',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'text-destructive bg-destructive/10 border-destructive/30 *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current',
        warning:
          'text-warning bg-warning/10 border-warning/30 *:data-[slot=alert-description]:text-warning/90 *:[svg]:text-current',
        info: 'text-blue-500 bg-blue-500/10 border-blue-500/30 *:data-[slot=alert-description]:text-blue-500/90 *:[svg]:text-current',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);
