function collectErrorText(error: unknown): string {
  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
    if ('cause' in error && error.cause instanceof Error) {
      parts.push(error.cause.message);
    }
  } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    parts.push(error.message);
  }

  return parts.join(' ').toLowerCase();
}

/** True when a sync failure is likely due to no network (airplane mode, offline, etc.). */
export function isOfflineSyncError(error: unknown): boolean {
  const text = collectErrorText(error);
  if (!text) {
    return false;
  }

  return (
    text.includes('network request failed') ||
    text.includes('failed to fetch') ||
    text.includes('network error') ||
    text.includes('load failed') ||
    text.includes('internet connection') ||
    text.includes('the internet connection appears to be offline') ||
    text.includes('enotfound') ||
    text.includes('econnrefused') ||
    text.includes('etimedout') ||
    text.includes('timeout') ||
    text.includes('offline')
  );
}
