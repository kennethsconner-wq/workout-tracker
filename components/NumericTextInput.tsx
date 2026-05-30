import { TextInput, type TextInputProps } from 'react-native';

import { DISPLAY_DECIMAL_PLACES } from '@/lib/displayDecimals';
import { INTEGER_DECIMAL_PLACES, sanitizeNumericInput } from '@/lib/numericInput';

type Props = Omit<TextInputProps, 'keyboardType' | 'onChangeText'> & {
  value: string;
  onChangeText: (value: string) => void;
  maxDecimalPlaces?: number;
};

export function NumericTextInput({
  value,
  onChangeText,
  maxDecimalPlaces = DISPLAY_DECIMAL_PLACES,
  ...rest
}: Props) {
  return (
    <TextInput
      {...rest}
      value={value}
      keyboardType={maxDecimalPlaces === INTEGER_DECIMAL_PLACES ? 'number-pad' : 'decimal-pad'}
      onChangeText={(raw) => onChangeText(sanitizeNumericInput(raw, maxDecimalPlaces))}
    />
  );
}
