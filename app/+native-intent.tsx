const AUTH_CALLBACK_ROUTE = '/auth/callback';
const AUTH_RESET_PASSWORD_ROUTE = '/auth/reset-password';

function isPasswordResetPath(raw: string): boolean {
  const lower = raw.toLowerCase();
  return lower.includes('auth/reset-password') || lower.includes('type=recovery');
}

/** Strip Expo Go's `exp://host:port/--/` prefix so auth paths are recognized. */
function normalizeIncomingPath(raw: string): string {
  const expoGoMatch = raw.match(/exps?:\/\/[^/]+\/--\/(.+)/);
  if (expoGoMatch) {
    return expoGoMatch[1];
  }

  if (raw.startsWith('/--/')) {
    return raw.slice(4);
  }

  return raw;
}

function unwrapDevClientUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === 'expo-development-client') {
      const inner = parsed.searchParams.get('url');
      if (inner) {
        return decodeURIComponent(inner);
      }
    }
  } catch {
    // Not a full URL — use as-is.
  }
  return raw;
}

function extractAuthQuery(raw: string): string | null {
  const hashIndex = raw.indexOf('#');
  if (hashIndex >= 0) {
    return raw.slice(hashIndex + 1);
  }

  const queryIndex = raw.indexOf('?');
  if (queryIndex >= 0) {
    return raw.slice(queryIndex + 1);
  }

  return null;
}

function isAuthCallbackPath(raw: string): boolean {
  if (isPasswordResetPath(raw)) {
    return false;
  }

  const lower = raw.toLowerCase();
  return (
    lower.includes('auth/callback') ||
    lower.includes('access_token') ||
    lower.includes('refresh_token') ||
    lower.includes('type=signup') ||
    lower.includes('type=email')
  );
}

/**
 * Rewrite Supabase auth deep links before Expo Router resolves them.
 * Needed because hash fragments and `scheme://host/path` URLs are easy to mis-route on native.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    const decoded = unwrapDevClientUrl(path).replace('#', '?');
    const raw = normalizeIncomingPath(decoded);

    if (isPasswordResetPath(raw)) {
      const query = extractAuthQuery(raw);
      if (query) {
        return `${AUTH_RESET_PASSWORD_ROUTE}?${query}`;
      }
      return AUTH_RESET_PASSWORD_ROUTE;
    }

    if (!isAuthCallbackPath(raw)) {
      return path;
    }

    const query = extractAuthQuery(raw);
    if (query) {
      return `${AUTH_CALLBACK_ROUTE}?${query}`;
    }
    return AUTH_CALLBACK_ROUTE;
  } catch {
    return path;
  }
}
