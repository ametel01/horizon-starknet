'use client';

import { Slider as SliderPrimitive } from '@base-ui/react/slider';
import { cn } from '@shared/lib/utils';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props): ReactNode {
  const _values = useMemo((): readonly number[] => {
    if (Array.isArray(value)) {
      return value as readonly number[];
    }
    if (Array.isArray(defaultValue)) {
      return defaultValue as readonly number[];
    }
    return [min, max];
  }, [value, defaultValue, min, max]);

  return (
    <SliderPrimitive.Root
      className="data-horizontal:w-full data-vertical:h-full"
      data-slot="slider"
      {...(defaultValue !== undefined && { defaultValue })}
      {...(value !== undefined && { value })}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control
        className={cn(
          'relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col',
          className
        )}
      >
        {/* Track height: 8px (h-2) per Steering Law - wider tracks are easier to navigate */}
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="bg-muted relative overflow-hidden rounded-4xl select-none data-horizontal:h-2 data-horizontal:w-full data-vertical:h-full data-vertical:w-2"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {_values.map((thumbValue) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={String(thumbValue)}
            className="border-primary ring-ring/50 block size-4 shrink-0 rounded-4xl border bg-white shadow-sm transition-colors select-none hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
