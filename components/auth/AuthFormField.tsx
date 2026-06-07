import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';

type AuthFormFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
};

export function AuthFormField({ label, error, style, ...inputProps }: AuthFormFieldProps) {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'dark';
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const inputBackground = activeScheme === 'dark' ? '#171717' : '#fafafa';
  const placeholderColor = activeScheme === 'dark' ? '#737373' : '#a3a3a3';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={placeholderColor}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.input,
          {
            borderColor,
            backgroundColor: inputBackground,
            color: '#23D5D5',
          },
          style,
        ]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    fontSize: 14,
    color: '#ef4444',
  },
});
