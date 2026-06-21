import { cn } from '@shared/lib/utils';
import { Label } from '@shared/ui/label';
import type * as React from 'react';

import { Input } from './InputBase';

interface FormInputProps extends React.ComponentProps<'input'> {
  label?: string;
  error?: string;
  hint?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

function FormInput({
  className,
  label,
  error,
  hint,
  leftElement,
  rightElement,
  id,
  ref,
  ...props
}: FormInputProps): React.JSX.Element {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full">
      {label && (
        <Label htmlFor={inputId} className="mb-1.5">
          {label}
        </Label>
      )}
      <div className="relative">
        {leftElement !== null && leftElement !== undefined && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {leftElement}
          </div>
        )}
        <Input
          id={inputId}
          ref={ref}
          className={cn(
            leftElement !== null && leftElement !== undefined && 'pl-10',
            rightElement !== null && rightElement !== undefined && 'pr-20',
            className
          )}
          aria-invalid={error !== undefined}
          {...props}
        />
        {rightElement !== null && rightElement !== undefined && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">{rightElement}</div>
        )}
      </div>
      {error && <p className="text-destructive mt-1.5 text-sm">{error}</p>}
      {hint && !error && <p className="text-muted-foreground mt-1.5 text-sm">{hint}</p>}
    </div>
  );
}

export type { FormInputProps };
export { FormInput };
