import { Switch as SwitchPrimitive } from '@kobalte/core/switch';
import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

type SwitchProps = ComponentProps<typeof SwitchPrimitive> & {
  /** Size variant */
  size?: 'sm' | 'default';
};

/**
 * Switch component for toggling between two states.
 *
 * Uses Kobalte Switch primitive which follows WAI-ARIA Switch pattern.
 * - Keyboard navigation (space to toggle)
 * - Screen reader support
 */
function Switch(props: SwitchProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'size']);
  const size = () => local.size ?? 'default';

  return (
    <SwitchPrimitive
      data-slot="switch"
      data-size={size()}
      class={cn(
        'data-[checked]:bg-primary bg-input focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 dark:bg-input/80 group/switch peer focus-visible:border-ring relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none focus-visible:ring-[3px] aria-invalid:ring-[3px] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px]',
        local.class
      )}
      {...others}
    >
      <SwitchPrimitive.Input class="peer" />
      <SwitchPrimitive.Control
        data-slot="switch-control"
        class="h-full w-full"
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          class="dark:bg-foreground dark:group-data-[checked]/switch:bg-primary-foreground bg-background pointer-events-none block rounded-full ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-[checked]:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-[checked]:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-[unchecked]:translate-x-0 group-data-[size=sm]/switch:data-[unchecked]:translate-x-0"
        />
      </SwitchPrimitive.Control>
    </SwitchPrimitive>
  );
}

// Export Kobalte primitive for direct access
export { SwitchPrimitive };

export { Switch };
export type { SwitchProps };
