import { randomBytes } from 'crypto';

/**
 * Generate a unique activation code in format: LINK-ABC123
 * Format breakdown:
 * - LINK- (prefix for easy identification)
 * - 6 random characters (alphanumeric, uppercase)
 *
 * This gives us a large enough space to avoid collisions while remaining
 * memorable and easy to type/share
 */
export function generateActivationCode(): string {
  // Generate 4 random bytes = 32-bit number
  // Take modulo 62 (a-z, A-Z, 0-9) to get a valid character
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 6; i++) {
    const randomByte = randomBytes(1)[0];
    code += chars[randomByte % chars.length];
  }

  return `LINK-${code}`;
}

/**
 * Validate activation code format
 */
export function isValidActivationCodeFormat(code: string): boolean {
  // Format: LINK-XXXXXX where X is alphanumeric
  const pattern = /^LINK-[A-Z0-9]{6}$/;
  return pattern.test(code);
}

/**
 * Generate Telegram deep link for activation
 * Format: https://t.me/hilmaibot?start=LINK123
 *
 * When user opens this link, Telegram passes LINK123 to bot's /start handler
 */
export function generateDeepLink(activationCode: string): string {
  // Remove 'LINK-' prefix and create deep link parameter
  const codeOnly = activationCode.replace('LINK-', '');
  return `https://t.me/hilmaibot?start=${activationCode}`;
}

/**
 * Extract activation code from Telegram /start parameter
 */
export function extractCodeFromStartParam(startParam: string): string | null {
  // Remove 'LINK-' prefix if present for easier parsing
  if (startParam.startsWith('LINK-')) {
    return startParam;
  }

  // Support both LINK-ABC123 and LINKABC123 formats for flexibility
  if (startParam.startsWith('LINK')) {
    return `LINK-${startParam.substring(4)}`;
  }

  return null;
}
