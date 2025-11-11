import { describe, expect, it } from 'vitest';
import { parseTimezoneInput } from '../lib/timezone-parser';

describe('parseTimezoneInput', () => {
  it('accepts canonical IANA timezone names', () => {
    const result = parseTimezoneInput('Asia/Tokyo');
    expect(result).toEqual({
      timezone: 'Asia/Tokyo',
      display: 'Asia/Tokyo',
    });
  });

  it('matches friendly city aliases', () => {
    const result = parseTimezoneInput('Bangkok');
    expect(result?.timezone).toBe('Asia/Bangkok');
    expect(result?.display).toContain('BANGKOK');
  });

  it('handles GMT offsets with minutes', () => {
    const result = parseTimezoneInput('+5:30');
    expect(result).toEqual({
      timezone: 'Asia/Kolkata',
      display: 'UTC+05:30 (Asia/Kolkata)',
      offset: 'UTC+05:30',
    });
  });

  it('supports decimal offsets', () => {
    const result = parseTimezoneInput('-9.5');
    expect(result).toEqual({
      timezone: 'Pacific/Marquesas',
      display: 'UTC-09:30 (Pacific/Marquesas)',
      offset: 'UTC-09:30',
    });
  });

  it('rejects invalid strings', () => {
    expect(parseTimezoneInput('tests')).toBeNull();
    expect(parseTimezoneInput('not a timezone')).toBeNull();
  });
});
