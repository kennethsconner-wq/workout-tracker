import { useLinkingURL } from 'expo-linking';
import { useEffect } from 'react';

import { markAccountOnboardingDismissed } from '@/lib/auth/accountOnboardingStorage';
import {
  buildAuthCallbackUrlFromParams,
  buildPasswordResetUrlFromParams,
  createSessionFromAuthRedirect,
  isAuthCallbackUrl,
  isPasswordResetRedirectUrl,
} from '@/lib/auth/authRedirect';

type AuthRedirectListenerProps = {
  params?: Record<string, string | string[] | undefined>;
  flow?: 'callback' | 'password-reset';
};

function shouldProcessAuthUrl(url: string, flow: 'callback' | 'password-reset'): boolean {
  return flow === 'password-reset' ? isPasswordResetRedirectUrl(url) : isAuthCallbackUrl(url);
}

function buildUrlFromParams(
  params: Record<string, string | string[] | undefined>,
  flow: 'callback' | 'password-reset',
): string | null {
  return flow === 'password-reset'
    ? buildPasswordResetUrlFromParams(params)
    : buildAuthCallbackUrlFromParams(params);
}

/** Finish Supabase email-confirm / password-reset deep links as early as possible. */
export function AuthRedirectListener({ params, flow = 'callback' }: AuthRedirectListenerProps) {
  const linkingUrl = useLinkingURL();

  useEffect(() => {
    const candidates = [linkingUrl, params ? buildUrlFromParams(params, flow) : null].filter(
      (url): url is string => typeof url === 'string' && url.length > 0,
    );

    for (const url of candidates) {
      if (!shouldProcessAuthUrl(url, flow)) {
        continue;
      }

      void createSessionFromAuthRedirect(url).then((result) => {
        if (result.ok && flow === 'callback' && result.type !== 'recovery') {
          void markAccountOnboardingDismissed();
        }
      });
      break;
    }
  }, [flow, linkingUrl, params]);

  return null;
}
