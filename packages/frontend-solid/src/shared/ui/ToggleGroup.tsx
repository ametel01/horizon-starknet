import { ToggleButton as TogglePrimitive } from '@kobalte/core/toggle-button';
import { cn } from '@shared/lib/utils';
import { toggleVariants } from '@shared/ui/Toggle';
import type { VariantProps } from 'class-variance-authority';
import { type ComponentProps, createContext, type JSX, splitProps, useContext } from 'solid-js';

type ToggleGroupContextValue = VariantProps<typeof toggleVariants> & {
  spacing?: number;
  orientation?: 'horizontal' | 'vertical';
};

const ToggleGroupContext = createContext<ToggleGroupContextValue>({
  size: 'default',
  variant: 'default',
  spacing: 0,
  orientation: 'horizontal',
});

type ToggleGroupProps = ComponentProps<'div'> &
  VariantProps<typeof toggleVariants> & {
    /** Gap between items (0 for connected style) */
    spacing?: number;
    /** Layout orientation */
    orientation?: 'horizontal' | 'vertical';
  };

/**
 * Toggle group container component.
 *
 * Groups multiple toggle items together with shared styling.
 * Set spacing=0 for connected appearance.
 */
function ToggleGroup(props: ToggleGroupProps): JSX.Element {
  const [local, others] = splitProps(props, [
    'class',
    'variant',
    'size',
    'spacing',
    'orientation',
    'children',
  ]);

  const spacing = () => local.spacing ?? 0;
  const orientation = () => local.orientation ?? 'horizontal';
  const variant = () => local.variant ?? 'default';
  const size = () => local.size ?? 'default';

  return (
    <ToggleGroupContext.Provider
      value={{
        get variant() {
          return variant();
        },
        get size() {
          return size();
        },
        get spacing() {
          return spacing();
        },
        get orientation() {
          return orientation();
        },
      }}
    >
      <div
        data-slot="toggle-group"
        data-variant={variant()}
        data-size={size()}
        data-spacing={spacing()}
        data-orientation={orientation()}
        style={{ '--gap': `${spacing()}px` }}
        class={cn(
          'group/toggle-group flex w-fit flex-row items-center data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch data-[spacing="0"]:data-[variant=outline]:rounded-4xl',
          local.class
        )}
        {...others}
      >
        {local.children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

type ToggleGroupItemProps = ComponentProps<typeof TogglePrimitive> &
  VariantProps<typeof toggleVariants>;

/**
 * Toggle group item component.
 *
 * Individual toggle button within a toggle group.
 * Inherits styling from parent ToggleGroup context.
 */
function ToggleGroupItem(props: ToggleGroupItemProps): JSX.Element {
  const context = useContext(ToggleGroupContext);
  const [local, others] = splitProps(props, ['class', 'variant', 'size']);

  const variant = () => context.variant ?? local.variant ?? 'default';
  const size = () => context.size ?? local.size ?? 'default';

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={variant()}
      data-size={size()}
      data-spacing={context.spacing}
      class={cn(
        'data-[pressed]:bg-muted shrink-0 group-data-[spacing="0"]/toggle-group:rounded-none group-data-[spacing="0"]/toggle-group:px-3 group-data-[spacing="0"]/toggle-group:shadow-none focus:z-10 focus-visible:z-10 group-data-[orientation=horizontal]/toggle-group:data-[spacing="0"]:first:rounded-l-4xl group-data-[orientation=vertical]/toggle-group:data-[spacing="0"]:first:rounded-t-xl group-data-[orientation=horizontal]/toggle-group:data-[spacing="0"]:last:rounded-r-4xl group-data-[orientation=vertical]/toggle-group:data-[spacing="0"]:last:rounded-b-xl group-data-[orientation=horizontal]/toggle-group:data-[spacing="0"]:data-[variant=outline]:border-l-0 group-data-[orientation=vertical]/toggle-group:data-[spacing="0"]:data-[variant=outline]:border-t-0 group-data-[orientation=horizontal]/toggle-group:data-[spacing="0"]:data-[variant=outline]:first:border-l group-data-[orientation=vertical]/toggle-group:data-[spacing="0"]:data-[variant=outline]:first:border-t',
        toggleVariants({ variant: variant(), size: size() }),
        local.class
      )}
      {...others}
    />
  );
}

export { ToggleGroup, ToggleGroupItem, ToggleGroupContext };
export type { ToggleGroupProps, ToggleGroupItemProps, ToggleGroupContextValue };
