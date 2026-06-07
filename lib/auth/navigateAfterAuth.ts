import type { Router } from 'expo-router';

/** Return to account after auth without stacking a second account screen. */
export function navigateAfterAuth(router: Router): void {
  router.dismissTo('/account');
}
