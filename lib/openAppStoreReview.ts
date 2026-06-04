import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import {
  ANDROID_PLAY_STORE_PACKAGE,
  IOS_APP_STORE_ID,
  androidPlayStoreReviewUrl,
  androidPlayStoreReviewWebUrl,
  iosAppStoreReviewUrl,
  iosAppStoreReviewWebUrl,
} from '@/constants/appLinks';
import { themedAlert } from '@/lib/themedAlert';

async function openUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Opens the platform store listing so the user can leave a rating. */
export async function openAppStoreReview(): Promise<void> {
  if (Platform.OS === 'android') {
    const opened = await openUrl(androidPlayStoreReviewUrl());
    if (!opened) {
      await openUrl(androidPlayStoreReviewWebUrl());
    }
    return;
  }

  if (Platform.OS === 'ios') {
    if (!IOS_APP_STORE_ID) {
      themedAlert(
        'App Store link not configured',
        'Add your App Store id to constants/appLinks.ts (IOS_APP_STORE_ID) so Rate the app can open your listing.',
      );
      return;
    }
    const opened = await openUrl(iosAppStoreReviewUrl(IOS_APP_STORE_ID));
    if (!opened) {
      await openUrl(iosAppStoreReviewWebUrl(IOS_APP_STORE_ID));
    }
    return;
  }

  themedAlert(
    'Rate on your device',
    `On Android, search for Axios Workouts on Google Play (${ANDROID_PLAY_STORE_PACKAGE}). On iOS, find the app in the App Store.`,
  );
}
