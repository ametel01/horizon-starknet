import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

import { Card, CardContent } from './Card';

/**
 * FormLayout - Consistent form container following UI/UX laws.
 *
 * Implements:
 * - Gestalt Proximity: Consistent spacing (space-y-6 between sections)
 * - Praegnanz: Simple, predictable structure
 * - Figure-Ground: Clear visual hierarchy with Card container
 *
 * Usage:
 * ```tsx
 * <FormLayout>
 *   <FormInputSection>
 *     <TokenInput ... />
 *   </FormInputSection>
 *   <FormDivider />
 *   <FormOutputSection>
 *     <OutputDisplay ... />
 *   </FormOutputSection>
 *   <FormInfoSection>
 *     <ExchangeRateInfo ... />
 *   </FormInfoSection>
 *   <FormActions>
 *     <Button size="xl" class="w-full">Submit</Button>
 *   </FormActions>
 * </FormLayout>
 * ```
 */

interface FormLayoutProps extends ComponentProps<'div'> {
  /** Optional gradient overlay for directional forms (buy/sell) */
  gradient?: 'primary' | 'destructive' | 'success' | 'none' | undefined;
}

/**
 * Main form container with consistent padding and spacing.
 * Wraps content in a Card with standard p-5 padding and space-y-6 gap.
 */
function FormLayout(props: FormLayoutProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'gradient', 'children']);
  const gradient = () => local.gradient ?? 'none';

  return (
    <Card class={cn('relative overflow-hidden', local.class)} {...others}>
      {/* Optional directional gradient overlay */}
      {gradient() !== 'none' && (
        <div
          class={cn(
            'pointer-events-none absolute inset-0 transition-all duration-500',
            gradient() === 'primary' &&
              'from-primary/5 bg-gradient-to-br via-transparent to-transparent',
            gradient() === 'destructive' &&
              'from-destructive/5 bg-gradient-to-br via-transparent to-transparent',
            gradient() === 'success' &&
              'from-success/5 bg-gradient-to-br via-transparent to-transparent'
          )}
          aria-hidden="true"
        />
      )}
      <CardContent class="relative space-y-6 p-5">{local.children}</CardContent>
    </Card>
  );
}

interface FormSectionProps extends ComponentProps<'div'> {}

/**
 * Form input section with tight spacing for related inputs.
 * Use for grouping token inputs, selectors, and related controls.
 *
 * Implements Miller's Law: Groups related elements for easier processing.
 */
function FormInputSection(props: FormSectionProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return <div class={cn('space-y-4', local.class)} {...others} />;
}

/**
 * Form output/preview section with muted background.
 * Use for displaying calculated outputs, previews, or results.
 *
 * Implements Figure-Ground: Visually distinct from input areas.
 */
function FormOutputSection(props: FormSectionProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'children']);

  return (
    <Card class={cn('bg-muted/50 overflow-hidden', local.class)}>
      <CardContent class="space-y-2 p-4" {...others}>
        {local.children}
      </CardContent>
    </Card>
  );
}

/**
 * Form info section for supplementary information.
 * Use for exchange rates, fees, and other reference data.
 *
 * Implements 60-30-10 Rule: Uses muted background for secondary info.
 */
function FormInfoSection(props: FormSectionProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'children']);

  return (
    <Card size="sm" class={cn('bg-muted', local.class)}>
      <CardContent class="p-3 text-sm" {...others}>
        {local.children}
      </CardContent>
    </Card>
  );
}

/**
 * Form actions section for primary and secondary buttons.
 * Adds top padding for visual separation from content.
 *
 * Implements Serial Position Effect: Places CTA at end for memorability.
 */
function FormActions(props: FormSectionProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return <div class={cn('pt-2', local.class)} {...others} />;
}

/**
 * Visual divider for form sections, typically with centered icon/button.
 * Use between input and output sections for clear separation.
 */
function FormDivider(props: FormSectionProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return <div class={cn('relative flex justify-center', local.class)} {...others} />;
}

/**
 * Form header section for title and description.
 * Use at the top of forms for context.
 */
interface FormHeaderProps extends ComponentProps<'div'> {
  title: string;
  description?: string | undefined;
  action?: JSX.Element | undefined;
}

function FormHeader(props: FormHeaderProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'title', 'description', 'action']);

  return (
    <div class={cn('flex items-start justify-between gap-4', local.class)} {...others}>
      <div class="space-y-1">
        <h3 class="text-base font-medium">{local.title}</h3>
        {local.description && <p class="text-muted-foreground text-sm">{local.description}</p>}
      </div>
      {local.action}
    </div>
  );
}

/**
 * Form row for inline label-value pairs.
 * Use in info sections and collapsible details.
 */
interface FormRowProps extends ComponentProps<'div'> {
  label: string;
  value: JSX.Element;
  labelClass?: string | undefined;
  valueClass?: string | undefined;
}

function FormRow(props: FormRowProps): JSX.Element {
  const [local, others] = splitProps(props, [
    'class',
    'label',
    'value',
    'labelClass',
    'valueClass',
  ]);

  return (
    <div class={cn('flex items-center justify-between gap-2', local.class)} {...others}>
      <span class={cn('text-muted-foreground', local.labelClass)}>{local.label}</span>
      <span class={cn('text-foreground', local.valueClass)}>{local.value}</span>
    </div>
  );
}

export {
  FormLayout,
  FormInputSection,
  FormOutputSection,
  FormInfoSection,
  FormActions,
  FormDivider,
  FormHeader,
  FormRow,
};

export type { FormLayoutProps, FormSectionProps, FormHeaderProps, FormRowProps };
