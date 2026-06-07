import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACCOUNT_ONBOARDING_DISMISSED_KEY = 'account-onboarding-dismissed@v1';

export async function isAccountOnboardingDismissed(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ACCOUNT_ONBOARDING_DISMISSED_KEY);
  return value === '1';
}

export async function markAccountOnboardingDismissed(): Promise<void> {
  await AsyncStorage.setItem(ACCOUNT_ONBOARDING_DISMISSED_KEY, '1');
}
