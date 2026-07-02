/** Extract the draft exercise id encoded in a countdown/rest timer id. */
export function exerciseIdFromCountdownTimerId(timerId: string): string | null {
  const parts = timerId.split(':');
  if (parts.length < 2) {
    return null;
  }

  switch (parts[0]) {
    case 'cardio':
    case 'sport':
    case 'stretch':
      return parts[1] ?? null;
    case 'rest':
      return parts[2] ?? null;
    default:
      return null;
  }
}
