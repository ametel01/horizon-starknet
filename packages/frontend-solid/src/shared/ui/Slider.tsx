import { Slider as SliderPrimitive } from '@kobalte/core/slider';
import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, For, splitProps, createMemo } from 'solid-js';

type SliderRootProps = ComponentProps<typeof SliderPrimitive> & {
  /** Default value for uncontrolled slider */
  defaultValue?: number[];
  /** Controlled value */
  value?: number[];
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
};

/**
 * Slider component for selecting values within a range.
 *
 * Uses Kobalte Slider primitive which follows WAI-ARIA Slider pattern.
 * - Keyboard navigation (arrow keys)
 * - Screen reader support
 * - Multi-thumb support
 */
function Slider(props: SliderRootProps): JSX.Element {
  const [local, others] = splitProps(props, [
    'class',
    'defaultValue',
    'value',
    'minValue',
    'maxValue',
  ]);

  const minVal = () => local.minValue ?? 0;
  const maxVal = () => local.maxValue ?? 100;

  const thumbCount = createMemo(() => {
    if (local.value) return local.value.length;
    if (local.defaultValue) return local.defaultValue.length;
    return 1;
  });

  return (
    <SliderPrimitive
      data-slot="slider"
      class={cn('relative flex w-full touch-none items-center select-none', local.class)}
      {...(local.defaultValue !== undefined && { defaultValue: local.defaultValue })}
      {...(local.value !== undefined && { value: local.value })}
      minValue={minVal()}
      maxValue={maxVal()}
      {...others}
    >
      {/* Track height: 8px (h-2) per Steering Law - wider tracks are easier to navigate */}
      <SliderPrimitive.Track
        data-slot="slider-track"
        class="bg-muted relative h-2 w-full overflow-hidden rounded-4xl select-none"
      >
        <SliderPrimitive.Fill
          data-slot="slider-range"
          class="bg-primary absolute h-full select-none"
        />
      </SliderPrimitive.Track>
      <For each={Array.from({ length: thumbCount() })}>
        {() => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            class="border-primary ring-ring/50 block size-4 shrink-0 rounded-4xl border bg-white shadow-sm transition-colors select-none hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          >
            <SliderPrimitive.Input />
          </SliderPrimitive.Thumb>
        )}
      </For>
    </SliderPrimitive>
  );
}

// Export Kobalte primitive for direct access
export { SliderPrimitive };

export { Slider };
export type { SliderRootProps };
