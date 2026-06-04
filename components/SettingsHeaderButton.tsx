import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export function SettingsHeaderButton() {
  const colorScheme = useColorScheme();

  return (
    <Link href="/settings" asChild>
      <Pressable
        style={{ marginRight: 15 }}
        accessibilityRole="button"
        accessibilityLabel="Settings">
        {({ pressed }) => (
          <Ionicons
            name="settings-outline"
            size={25}
            color={Colors[colorScheme].text}
            style={{ opacity: pressed ? 0.5 : 1 }}
          />
        )}
      </Pressable>
    </Link>
  );
}
