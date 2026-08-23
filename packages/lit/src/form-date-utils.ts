// ─── Date field helpers ────────────────────────────────────────
// <input type="date"> works with "YYYY-MM-DD" strings, but Zod's `z.date()`
// expects a real Date. Convert at the render/update boundary so the stored
// form value is always a Date (or undefined), matching what `z.date()` needs.

export function parseDateInputValue(str: string): Date | undefined {
  if (!str) return undefined;
  // Force local-midnight parsing; a bare "YYYY-MM-DD" is parsed as UTC by
  // `Date`, which can shift the day in timezones behind UTC.
  const date = new Date(`${str}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function toDateInputValue(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return typeof value === 'string' ? value : '';
}
