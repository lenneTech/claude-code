// ============================================================================
// Display formatting shared by all pages (auto-imported)
// ============================================================================

/**
 * Formats an ISO date (YYYY-MM-DD) or date-time for display in German, e.g. 17.10.2026. Empty values become "-".
 */
export function formatDate(value?: null | string): string {
  if (!value) {
    return '-';
  }
  // A plain ISO date is a calendar day: format it in UTC, so no time zone moves it to the day before
  const isCalendarDay: boolean = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(isCalendarDay ? { timeZone: 'UTC' } : {}),
  }).format(new Date(value));
}

/**
 * Today as ISO calendar day (YYYY-MM-DD) in the user's time zone, e.g. as lower bound for date fields
 */
export function todayIsoDate(): string {
  const now: Date = new Date();
  const month: string = String(now.getMonth() + 1).padStart(2, '0');
  const day: string = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
