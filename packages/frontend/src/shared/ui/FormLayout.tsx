'use client';

import * as React from 'react';

import { cn } from '@shared/lib/utils';

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
 *     <Button size="xl" className="w-full">Submit</Button>
 *   </FormActions>
 * </FormLayout>
 * ```
 */

interface FormLayoutProps {
  children: React.ReactNode;
  className?: string | undefined;
  /** Optional gradient overlay for directional forms (buy/sell) */
  gradient?: 'primary' | 'destructive' | 'success' | 'none' | undefined;
}

/**
 * Main form container with consistent padding and spacing.
 * Wraps content in a Card with standard p-5 padding and space-y-6 gap.
 */
function FormLayout({
  children,
  className,
  gradient = 'none',
}: FormLayoutProps): React.JSX.Element {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {/* Optional directional gradient overlay */}
      {gradient !== 'none' && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 transition-all duration-500',
            gradient === 'primary' &&
              'from-primary/5 bg-gradient-to-br via-transparent to-transparent',
            gradient === 'destructive' &&
              'from-destructive/5 bg-gradient-to-br via-transparent to-transparent',
            gradient === 'success' &&
              'from-success/5 bg-gradient-to-br via-transparent to-transparent'
          )}
          aria-hidden="true"
        />
      )}
      <CardContent className="relative space-y-6 p-5">{children}</CardContent>
    </Card>
  );
}

interface FormSectionProps {
  children: React.ReactNode;
  className?: string | undefined;
}

/**
 * Form input section with tight spacing for related inputs.
 * Use for grouping token inputs, selectors, and related controls.
 *
 * Implements Miller's Law: Groups related elements for easier processing.
 */
function FormInputSection({ children, className }: FormSectionProps): React.JSX.Element {
  return <div className={cn('space-y-4', className)}>{children}</div>;
}

/**
 * Form output/preview section with muted background.
 * Use for displaying calculated outputs, previews, or results.
 *
 * Implements Figure-Ground: Visually distinct from input areas.
 */
function FormOutputSection({ children, className }: FormSectionProps): React.JSX.Element {
  return (
    <Card className={cn('bg-muted/50 overflow-hidden', className)}>
      <CardContent className="space-y-2 p-4">{children}</CardContent>
    </Card>
  );
}

/**
 * Form info section for supplementary information.
 * Use for exchange rates, fees, and other reference data.
 *
 * Implements 60-30-10 Rule: Uses muted background for secondary info.
 */
function FormInfoSection({ children, className }: FormSectionProps): React.JSX.Element {
  return (
    <Card size="sm" className={cn('bg-muted', className)}>
      <CardContent className="p-3 text-sm">{children}</CardContent>
    </Card>
  );
}

/**
 * Form actions section for primary and secondary buttons.
 * Adds top padding for visual separation from content.
 *
 * Implements Serial Position Effect: Places CTA at end for memorability.
 */
function FormActions({ children, className }: FormSectionProps): React.JSX.Element {
  return <div className={cn('pt-2', className)}>{children}</div>;
}

/**
 * Visual divider for form sections, typically with centered icon/button.
 * Use between input and output sections for clear separation.
 */
function FormDivider({ children, className }: FormSectionProps): React.JSX.Element {
  return <div className={cn('relative flex justify-center', className)}>{children}</div>;
}

/**
 * Form header section for title and description.
 * Use at the top of forms for context.
 */
interface FormHeaderProps {
  title: string;
  description?: string | undefined;
  className?: string | undefined;
  action?: React.ReactNode | undefined;
}

function FormHeader({ title, description, className, action }: FormHeaderProps): React.JSX.Element {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="space-y-1">
        <h3 className="text-base font-medium">{title}</h3>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Form row for inline label-value pairs.
 * Use in info sections and collapsible details.
 */
interface FormRowProps {
  label: string;
  value: React.ReactNode;
  className?: string | undefined;
  labelClassName?: string | undefined;
  valueClassName?: string | undefined;
}

function FormRow({
  label,
  value,
  className,
  labelClassName,
  valueClassName,
}: FormRowProps): React.JSX.Element {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <span className={cn('text-muted-foreground', labelClassName)}>{label}</span>
      <span className={cn('text-foreground', valueClassName)}>{value}</span>
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
