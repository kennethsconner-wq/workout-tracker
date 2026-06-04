import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

import { FEEDBACK_EMAIL } from '@/constants/appLinks';
import { themedAlert } from '@/lib/themedAlert';

function feedbackMailtoUrl(): string {
  const appName = Constants.expoConfig?.name ?? 'Axios Workouts';
  const subject = encodeURIComponent(`${appName} Feedback`);
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}`;
}

/** Opens the device mail app with a new message to the feedback address. */
export async function openFeedbackEmail(): Promise<void> {
  try {
    await Linking.openURL(feedbackMailtoUrl());
  } catch {
    themedAlert(
      'Could not open email',
      `Try sending feedback to ${FEEDBACK_EMAIL} from your mail app.`,
    );
  }
}
