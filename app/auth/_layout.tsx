import { Stack } from 'expo-router';

import Colors from '@/constants/Colors';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';

const appBackground = Colors.dark.background;

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'card',
        ...stackHeaderHideIosBackLabel,
        headerStyle: { backgroundColor: appBackground },
        headerTintColor: Colors.dark.text,
        contentStyle: { backgroundColor: appBackground },
      }}
    />
  );
}
