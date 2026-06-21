import * as React from 'react';

import { FormInput, type FormInputProps } from './FormInput';

interface NumberInputProps extends Omit<FormInputProps, 'type' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
}

function NumberInput({
  value,
  onChange,
  decimals = 18,
  ref,
  ...props
}: NumberInputProps): React.JSX.Element {
  // Hoist RegExp creation to avoid allocation on every keystroke (js-hoist-regexp)
  const regex = React.useMemo(() => new RegExp(`^\\d*\\.?\\d{0,${String(decimals)}}$`), [decimals]);

  const updateDecimalValue = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const inputValue = e.target.value;

    if (inputValue === '') {
      onChange('');
      return;
    }

    if (regex.test(inputValue)) {
      onChange(inputValue);
    }
  };

  return (
    <FormInput
      ref={ref}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={updateDecimalValue}
      {...props}
    />
  );
}

export { NumberInput };
