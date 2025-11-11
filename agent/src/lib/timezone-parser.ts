/**
 * Timezone Parser Module
 *
 * Parses user input and converts it to IANA timezone format
 * Supports: city names, GMT offsets (+7, -5), IANA timezone names
 */

/**
 * City name to IANA timezone mapping
 * Supports common city names and maps to appropriate IANA timezone
 */
const CITY_TO_TIMEZONE: Record<string, string> = {
  // Asia
  bangkok: 'Asia/Bangkok',
  bangkok_thailand: 'Asia/Bangkok',
  thailand: 'Asia/Bangkok',
  dubai: 'Asia/Dubai',
  uae: 'Asia/Dubai',
  india: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata',
  mumbai: 'Asia/Kolkata',
  kolkata: 'Asia/Kolkata',
  shanghai: 'Asia/Shanghai',
  china: 'Asia/Shanghai',
  beijing: 'Asia/Shanghai',
  tokyo: 'Asia/Tokyo',
  japan: 'Asia/Tokyo',
  hong_kong: 'Asia/Hong_Kong',
  singapore: 'Asia/Singapore',
  karachi: 'Asia/Karachi',
  pakistan: 'Asia/Karachi',
  dhaka: 'Asia/Dhaka',
  bangladesh: 'Asia/Dhaka',

  // Europe
  london: 'Europe/London',
  uk: 'Europe/London',
  paris: 'Europe/Paris',
  france: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  germany: 'Europe/Berlin',
  moscow: 'Europe/Moscow',
  russia: 'Europe/Moscow',
  istanbul: 'Europe/Istanbul',
  turkey: 'Europe/Istanbul',
  cairo: 'Africa/Cairo',
  egypt: 'Africa/Cairo',

  // Americas
  new_york: 'America/New_York',
  newyork: 'America/New_York',
  nyc: 'America/New_York',
  usa_east: 'America/New_York',
  chicago: 'America/Chicago',
  denver: 'America/Denver',
  los_angeles: 'America/Los_Angeles',
  la: 'America/Los_Angeles',
  usa_west: 'America/Los_Angeles',
  toronto: 'America/Toronto',
  canada: 'America/Toronto',
  mexico: 'America/Mexico_City',
  mexico_city: 'America/Mexico_City',
  sao_paulo: 'America/Sao_Paulo',
  brazil: 'America/Sao_Paulo',

  // Oceania
  sydney: 'Australia/Sydney',
  australia: 'Australia/Sydney',
  auckland: 'Pacific/Auckland',
  newzealand: 'Pacific/Auckland',
  fiji: 'Pacific/Fiji',
  honolulu: 'Pacific/Honolulu',
  hawaii: 'Pacific/Honolulu',

  // UTC
  utc: 'UTC',
  gmt: 'UTC',
};

/**
 * Parse GMT/UTC offset string to IANA timezone
 * Examples: "+7", "-5", "+5:30", "UTC+7"
 *
 * @param offsetStr - Offset string
 * @returns IANA timezone or null if invalid
 */
type OffsetParseResult = {
  timezone: string;
  offsetLabel: string;
};

const MINUTE_OFFSET_TO_TIMEZONE: Record<number, string> = {
  [-720]: 'Etc/GMT+12',
  [-660]: 'Pacific/Pago_Pago',
  [-600]: 'Pacific/Honolulu',
  [-570]: 'Pacific/Marquesas',
  [-540]: 'America/Anchorage',
  [-480]: 'America/Los_Angeles',
  [-420]: 'America/Denver',
  [-360]: 'America/Chicago',
  [-300]: 'America/New_York',
  [-270]: 'America/Caracas',
  [-240]: 'America/Halifax',
  [-210]: 'America/St_Johns',
  [-180]: 'America/Sao_Paulo',
  [-120]: 'Etc/GMT+2',
  [-60]: 'Atlantic/Azores',
  0: 'UTC',
  60: 'Europe/Paris',
  120: 'Europe/Athens',
  180: 'Europe/Moscow',
  210: 'Asia/Tehran',
  240: 'Asia/Dubai',
  270: 'Asia/Kabul',
  300: 'Asia/Karachi',
  330: 'Asia/Kolkata',
  345: 'Asia/Kathmandu',
  360: 'Asia/Dhaka',
  390: 'Asia/Yangon',
  420: 'Asia/Bangkok',
  480: 'Asia/Shanghai',
  525: 'Australia/Eucla',
  540: 'Asia/Tokyo',
  570: 'Australia/Darwin',
  600: 'Australia/Sydney',
  630: 'Australia/Lord_Howe',
  660: 'Pacific/Guadalcanal',
  690: 'Pacific/Norfolk',
  720: 'Pacific/Fiji',
  765: 'Pacific/Chatham',
  780: 'Pacific/Apia',
  840: 'Pacific/Kiritimati',
};

function formatOffsetLabel(totalMinutes: number): string {
  const sign = totalMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (absMinutes % 60).toString().padStart(2, '0');

  return `UTC${sign}${hours}:${minutes}`;
}

function parseGMTOffset(offsetStr: string): OffsetParseResult | null {
  // Clean input
  const cleaned = offsetStr
    .toUpperCase()
    .replace(/UTC|GMT/g, '')
    .trim();

  if (!cleaned || !/^[-+]/.test(cleaned)) {
    return null;
  }

  const sign = cleaned.startsWith('-') ? -1 : 1;
  const body = cleaned.slice(1);

  let totalMinutes = 0;

  if (body.includes(':')) {
    const [hoursPart, minutesPart] = body.split(':');
    const hours = parseInt(hoursPart, 10);
    const minutes = parseInt(minutesPart ?? '0', 10);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }

    totalMinutes = sign * (hours * 60 + minutes);
  } else if (body.includes('.')) {
    const [hoursPart, decimalPart] = body.split('.');
    const hours = parseInt(hoursPart, 10);
    const decimal = parseFloat(`0.${decimalPart}`);

    if (Number.isNaN(hours) || Number.isNaN(decimal)) {
      return null;
    }

    totalMinutes = sign * Math.round((hours + decimal) * 60);
  } else {
    const hours = parseInt(body, 10);

    if (Number.isNaN(hours)) {
      return null;
    }

    totalMinutes = sign * hours * 60;
  }

  // Validate total minutes
  const absMinutes = Math.abs(totalMinutes);
  if (absMinutes > 14 * 60 || absMinutes < 0) {
    return null;
  }

  // Only allow quarter-hour precision to avoid accidental typos
  if (absMinutes % 15 !== 0) {
    return null;
  }

  const timezone = MINUTE_OFFSET_TO_TIMEZONE[totalMinutes];
  if (!timezone) {
    return null;
  }

  return {
    timezone,
    offsetLabel: formatOffsetLabel(totalMinutes),
  };
}

/**
 * Resolve canonical IANA timezone name or return null if invalid
 */
function getCanonicalTimezone(tz: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/**
 * Parse user timezone input
 *
 * Supports multiple formats:
 * 1. City names: "Bangkok", "New York", "Dubai"
 * 2. GMT offsets: "+7", "-5", "+5:30"
 * 3. IANA timezone: "Asia/Bangkok", "America/New_York"
 *
 * @param userInput - User-provided timezone input
 * @returns Object with timezone string and normalized description, or error
 */
export function parseTimezoneInput(userInput: string): {
  timezone: string;
  display: string;
  offset?: string;
} | null {
  if (!userInput || userInput.trim().length === 0) {
    return null;
  }

  const trimmedInput = userInput.trim();
  const normalizedInput = trimmedInput.toLowerCase();

  // Try 1: Check if it's a valid IANA timezone already
  const canonicalTimezone = getCanonicalTimezone(trimmedInput);
  if (canonicalTimezone) {
    return {
      timezone: canonicalTimezone,
      display: canonicalTimezone,
    };
  }

  // Try 2: Check city name mapping
  const cityMatch = Object.entries(CITY_TO_TIMEZONE).find(
    ([city]) =>
      city === normalizedInput.replace(/\s+/g, '_') || city === normalizedInput.replace(/_/g, ' ')
  );

  if (cityMatch) {
    const [cityName, timezone] = cityMatch;
    // Get offset for display
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
      const parts = formatter.formatToParts(new Date());
      const tzNamePart = parts.find((p) => p.type === 'timeZoneName');
      const tzName = tzNamePart?.value || '';

      return {
        timezone,
        display: `${cityName.replace(/_/g, ' ').toUpperCase()} (${tzName})`,
        offset: tzName,
      };
    } catch {
      return {
        timezone,
        display: `${cityName.replace(/_/g, ' ').toUpperCase()}`,
      };
    }
  }

  // Try 3: Check GMT/UTC offset format
  const offsetTimezone = parseGMTOffset(normalizedInput);
  if (offsetTimezone) {
    return {
      timezone: offsetTimezone.timezone,
      display: `${offsetTimezone.offsetLabel} (${offsetTimezone.timezone})`,
      offset: offsetTimezone.offsetLabel,
    };
  }

  return null;
}

/**
 * Get confirmation message for timezone
 *
 * @param result - Parsed timezone result
 * @returns Confirmation message
 */
export function getTimezoneConfirmation(result: {
  timezone: string;
  display: string;
  offset?: string;
}): string {
  return (
    `✅ *Timezone Set!*\n\n` +
    `📍 Timezone: *${result.display}*\n` +
    `🔧 IANA Format: \`${result.timezone}\`\n\n` +
    `Your transactions will now be logged with dates based on this timezone.`
  );
}

/**
 * List common timezone options
 *
 * @returns Formatted list of common timezones
 */
export function getTimezoneOptions(): string {
  return (
    `*Quick timezone setup options:*\n\n` +
    `*Asia:*\n` +
    `• \`/timezone Bangkok\` (UTC+7)\n` +
    `• \`/timezone Dubai\` (UTC+4)\n` +
    `• \`/timezone India\` (UTC+5:30)\n` +
    `• \`/timezone Tokyo\` (UTC+9)\n\n` +
    `*Europe:*\n` +
    `• \`/timezone London\` (UTC+0)\n` +
    `• \`/timezone Paris\` (UTC+1)\n` +
    `• \`/timezone Moscow\` (UTC+3)\n\n` +
    `*Americas:*\n` +
    `• \`/timezone New York\` (UTC-5)\n` +
    `• \`/timezone Chicago\` (UTC-6)\n` +
    `• \`/timezone Los Angeles\` (UTC-8)\n\n` +
    `*Or use GMT offset:*\n` +
    `• \`/timezone +7\` (UTC+7)\n` +
    `• \`/timezone -5\` (UTC-5)\n` +
    `• \`/timezone +5:30\` (UTC+5:30)\n\n` +
    `*Or use IANA timezone:*\n` +
    `• \`/timezone Asia/Bangkok\`\n` +
    `• \`/timezone America/New_York\``
  );
}
