import { describe, expect, it } from 'vitest';
import { parseDateInputValue, toDateInputValue } from './form-date-utils';

describe('parseDateInputValue', () => {
  it('parses a date input string at local midnight', () => {
    const date = parseDateInputValue('2024-03-05')!;

    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(5);
    expect(date.getHours()).toBe(0);
  });

  it('does not shift the day for timezones behind UTC', () => {
    // "2024-01-01" を UTC として解釈すると UTC-n の地域で前日にずれる
    expect(parseDateInputValue('2024-01-01')!.getDate()).toBe(1);
  });

  it('returns undefined for an empty string', () => {
    expect(parseDateInputValue('')).toBeUndefined();
  });

  it('returns undefined for an unparseable string', () => {
    expect(parseDateInputValue('not-a-date')).toBeUndefined();
  });
});

describe('toDateInputValue', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(toDateInputValue(new Date(2024, 2, 5))).toBe('2024-03-05');
  });

  it('zero-pads single-digit months and days', () => {
    expect(toDateInputValue(new Date(2024, 0, 9))).toBe('2024-01-09');
  });

  it('returns an empty string for an invalid Date', () => {
    expect(toDateInputValue(new Date('nope'))).toBe('');
  });

  it('passes a string through unchanged', () => {
    expect(toDateInputValue('2024-03-05')).toBe('2024-03-05');
  });

  it.each([[undefined], [null], [42], [{}]])('returns an empty string for %s', (value) => {
    expect(toDateInputValue(value)).toBe('');
  });

  it('round-trips through parseDateInputValue', () => {
    expect(toDateInputValue(parseDateInputValue('2024-12-31'))).toBe('2024-12-31');
  });
});
