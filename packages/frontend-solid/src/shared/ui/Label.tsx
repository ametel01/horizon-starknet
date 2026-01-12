import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

type LabelProps = ComponentProps<'label'>;

/**
 * Label component for form elements.
 *
 * Provides consistent styling for form labels with support for
 * disabled states via parent group data attributes.
 */
function Label(props: LabelProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <label
      data-slot="label"
      class={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        local.class
      )}
      {...others}
    />
  );
}

export { Label };
export type { LabelProps };
