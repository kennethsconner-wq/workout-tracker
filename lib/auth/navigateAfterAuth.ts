import type { Router } from 'expo-router';

/** Return to account after auth without stacking a second account screen. */
export function navigateAfterAuth(router: Router): void {
  router.dismissTo('/account');
}

/** Return to sign-in without duplicating it in the auth stack (e.g. after forgot/reset password). */
export function navigateToSignIn(router: Router): void {
  router.dismissTo('/auth/sign-in');
}

/** Open reset-password without stacking on top of callback or other auth screens. */
export function navigateToResetPassword(router: Router): void {
  router.dismissTo('/auth/reset-password');
}

/** Return to the main Workouts tab without leaving auth screens on the stack. */
export function navigateToWorkouts(router: Router): void {
  router.dismissTo('/');
}
