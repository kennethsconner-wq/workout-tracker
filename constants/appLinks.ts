/** Android application id from app.json — used for Play Store review links. */
export const ANDROID_PLAY_STORE_PACKAGE = 'com.kconsoft.workouttracker';

/**
 * Numeric App Store id from App Store Connect (e.g. 1234567890).
 * Set this when the iOS app is published so "Rate the app" opens the correct listing.
 */
export const IOS_APP_STORE_ID = '';

export const PAYPAL_DONATE_URL = 'https://paypal.me/KConSoft';

export const FEEDBACK_EMAIL = 'kconsoft@gmail.com';

export function androidPlayStoreReviewUrl(): string {
  return `market://details?id=${ANDROID_PLAY_STORE_PACKAGE}`;
}

export function androidPlayStoreReviewWebUrl(): string {
  return `https://play.google.com/store/apps/details?id=${ANDROID_PLAY_STORE_PACKAGE}`;
}

export function iosAppStoreReviewUrl(appStoreId: string): string {
  return `itms-apps://apps.apple.com/app/id${appStoreId}?action=write-review`;
}

export function iosAppStoreReviewWebUrl(appStoreId: string): string {
  return `https://apps.apple.com/app/id${appStoreId}?action=write-review`;
}
