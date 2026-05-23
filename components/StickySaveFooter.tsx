import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';

type StickySaveFooterProps = {
  onPress: () => void;
  activeScheme: 'light' | 'dark';
  label?: string;
  /** When false, omit bottom safe-area inset (e.g. tab screens already sit above the tab bar). */
  insetBottom?: boolean;
};

export function StickySaveFooter({
  onPress,
  activeScheme,
  label = 'Save',
  insetBottom = true,
}: StickySaveFooterProps) {
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const backgroundColor = Colors[activeScheme].background;

  const inner = (
    <View
      style={[
        styles.wrap,
        {
          borderTopColor: borderColor,
          backgroundColor,
          paddingBottom: insetBottom ? 12 : 8,
        },
      ]}>
      <Pressable
        onPress={onPress}
        style={[styles.button, { backgroundColor: Colors[activeScheme].tint }]}>
        <Text style={[styles.label, { color: Colors[activeScheme].background }]}>{label}</Text>
      </Pressable>
    </View>
  );

  if (!insetBottom) {
    return inner;
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor }}>
      {inner}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
  },
});
