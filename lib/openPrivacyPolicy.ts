import * as WebBrowser from 'expo-web-browser';

import { PRIVACY_POLICY_URL } from '@/constants/appLinks';
import { themedAlert } from '@/lib/themedAlert';

/** Opens the hosted privacy policy in an in-app browser. */
export async function openPrivacyPolicy(): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
  } catch {
    themedAlert('Could not open privacy policy', `Visit ${PRIVACY_POLICY_URL} in your browser.`);
  }
}
