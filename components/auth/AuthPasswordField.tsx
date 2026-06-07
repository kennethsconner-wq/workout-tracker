import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type AuthPasswordFieldProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string;
  error?: string | null;
};

export function AuthPasswordField({ label, error, style, ...inputProps }: AuthPasswordFieldProps) {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'dark';
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const inputBackground = activeScheme === 'dark' ? '#171717' : '#fafafa';
  const placeholderColor = activeScheme === 'dark' ? '#737373' : '#a3a3a3';
  const tint = Colors[activeScheme].tint;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, { borderColor, backgroundColor: inputBackground }]}>
        <TextInput
          placeholderTextColor={placeholderColor}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!isVisible}
          style={[styles.input, { color: tint }, style]}
          {...inputProps}
        />
        <Pressable
          onPress={() => setIsVisible((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
          hitSlop={8}
          style={({ pressed }) => [styles.toggleButton, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name={isVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color={tint} />
        </Pressable>
      </View>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  toggleButton: {
    padding: 8,
  },
  error: {
    fontSize: 14,
    color: '#ef4444',
  },
});
