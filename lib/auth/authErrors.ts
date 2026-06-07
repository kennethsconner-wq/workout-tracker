import type { AuthError } from '@supabase/supabase-js';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.',
  email_not_confirmed: 'Check your email and confirm your account before signing in.',
  user_already_exists: 'An account with this email already exists. Try signing in.',
  weak_password: 'Password must be at least 6 characters.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts. Wait a few minutes and try again.',
};

export function toAuthErrorMessage(error: AuthError | Error | null | undefined): string {
  if (!error) {
    return 'Something went wrong. Please try again.';
  }

  if ('code' in error && typeof error.code === 'string') {
    const mapped = AUTH_ERROR_MESSAGES[error.code];
    if (mapped) {
      return mapped;
    }
  }

  if (error.message) {
    const normalizedMessage = error.message.toLowerCase();
    if (normalizedMessage.includes('invalid login credentials')) {
      return AUTH_ERROR_MESSAGES.invalid_credentials;
    }
    if (
      normalizedMessage.includes('too many emails') ||
      normalizedMessage.includes('email rate limit') ||
      normalizedMessage.includes('rate limit exceeded')
    ) {
      return AUTH_ERROR_MESSAGES.over_email_send_rate_limit;
    }
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Email is required.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Enter a valid email address.';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters.';
  }
  return null;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) {
    return 'Username is required.';
  }
  if (trimmed.length < 3) {
    return 'Username must be at least 3 characters.';
  }
  if (trimmed.length > 30) {
    return 'Username must be 30 characters or fewer.';
  }
  if (!/^[a-zA-Z0-9]/.test(trimmed)) {
    return 'Username must start with a letter or number.';
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return 'Use only letters, numbers, and underscores.';
  }
  return null;
}

export function normalizeUsername(username: string): string {
  return username.trim();
}
