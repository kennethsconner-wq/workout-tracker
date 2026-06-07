import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { useColorScheme } from '@/components/useColorScheme';
import { openAppStoreReview } from '@/lib/openAppStoreReview';
import { openFeedbackEmail } from '@/lib/openFeedbackEmail';

type SettingsRow = {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const textColor = Colors[activeScheme].text;
  const tint = Colors[activeScheme].tint;
  const borderColor = activeScheme === 'dark' ? '#333' : '#e5e5e5';
  const chevronColor = activeScheme === 'dark' ? '#737373' : '#a3a3a3';

  const rows: SettingsRow[] = [
    {
      key: 'account',
      title: 'Account',
      icon: 'person-circle-outline',
      onPress: () => router.push('/account'),
    },
    {
      key: 'exercise-library',
      title: 'Exercise Library',
      icon: 'library-outline',
      onPress: () =>
        router.push({
          pathname: '/exercise-library',
          params: { libraryEntry: 'menu' },
        }),
    },
    {
      key: 'about',
      title: 'About',
      icon: 'information-circle-outline',
      onPress: () => router.push('/about'),
    },
    {
      key: 'feedback',
      title: 'Feedback',
      icon: 'mail-outline',
      onPress: () => {
        void openFeedbackEmail();
      },
    },
    {
      key: 'donate',
      title: 'Donate',
      icon: 'heart-outline',
      onPress: () => router.push('/donate'),
    },
    {
      key: 'rate',
      title: 'Rate the App',
      icon: 'star-outline',
      onPress: () => {
        void openAppStoreReview();
      },
    },
  ];

  const renderItem = useCallback(
    ({ item }: { item: SettingsRow }) => (
      <Pressable
        onPress={item.onPress}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={({ pressed }) => [styles.row, { borderColor, opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name={item.icon} size={22} color={tint} style={styles.rowIcon} />
        <Text style={[styles.rowTitle, { color: textColor }]}>{item.title}</Text>
        <Ionicons name="chevron-forward" size={20} color={chevronColor} />
      </Pressable>
    ),
    [borderColor, chevronColor, textColor, tint],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
          presentation: 'card',
          ...stackHeaderHideIosBackLabel,
        }}
      />
      <View style={styles.screen}>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
        <StatusBar style="light" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    marginRight: 14,
  },
  rowTitle: {
    flex: 1,
    fontSize: 17,
  },
});
