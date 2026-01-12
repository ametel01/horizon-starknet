import { Separator as SeparatorPrimitive } from '@kobalte/core/separator';
import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

type SeparatorProps = ComponentProps<typeof SeparatorPrimitive> & {
  /** Orientation of the separator */
  orientation?: 'horizontal' | 'vertical';
};

/**
 * Separator component for visual separation of content.
 *
 * Uses Kobalte Separator primitive which follows WAI-ARIA pattern.
 * - Semantic separator role
 * - Orientation support
 */
function Separator(props: SeparatorProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'orientation']);
  const orientation = () => local.orientation ?? 'horizontal';

  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation()}
      class={cn(
        'bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch',
        local.class
      )}
      {...others}
    />
  );
}

// Export Kobalte primitive for direct access
export { SeparatorPrimitive };

export { Separator };
export type { SeparatorProps };
