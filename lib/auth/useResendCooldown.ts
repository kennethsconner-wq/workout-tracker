import { useCallback, useEffect, useState } from 'react';

/** Matches Supabase's typical email send rate limit window. */
export const EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS = 60;

export function formatResendCooldown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}s`;
}

export function useResendCooldown(initialSeconds = EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS) {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setSecondsRemaining((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsRemaining]);

  const restartCooldown = useCallback(() => {
    setSecondsRemaining(initialSeconds);
  }, [initialSeconds]);

  return {
    secondsRemaining,
    canResend: secondsRemaining <= 0,
    restartCooldown,
  };
}
