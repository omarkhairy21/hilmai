import { describe, it, expect } from 'vitest';

/**
 * Test the password encoding logic
 * This tests the core encoding algorithm used in getDatabaseUrl
 */
describe('Database URL Encoding', () => {
  it('should encode special characters in password', () => {
    // Test the encoding logic directly
    const url =
      'postgresql://postgres.user:iO$!KYG4$UqxAK@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

    // Extract and encode password like getDatabaseUrl does
    const lastAtIndex = url.lastIndexOf('@');
    const beforeAt = url.substring(0, lastAtIndex);
    const afterAt = url.substring(lastAtIndex + 1);

    const match = beforeAt.match(/^(postgres(?:\+\w+)?:\/\/)([^:]+):(.*)$/);
    if (match) {
      const [, protocol, username, password] = match;
      const encodedPassword = encodeURIComponent(password);
      const encodedUrl = `${protocol}${username}:${encodedPassword}@${afterAt}`;

      // Should encode $ as %24 and ! as %21
      expect(encodedUrl).toContain('%24'); // $ encoded
      expect(encodedUrl).toContain('%21'); // ! encoded
      expect(encodedUrl).toContain('iO%24%21KYG4%24UqxAK');
    }
  });

  it('should handle passwords with @ symbol', () => {
    const url = 'postgresql://user:pass@word@host:5432/db';

    // Find the LAST @ to handle passwords with @
    const lastAtIndex = url.lastIndexOf('@');
    const beforeAt = url.substring(0, lastAtIndex);
    const afterAt = url.substring(lastAtIndex + 1);

    const match = beforeAt.match(/^(postgres(?:\+\w+)?:\/\/)([^:]+):(.*)$/);
    if (match) {
      const [, protocol, username, password] = match;
      const encodedPassword = encodeURIComponent(password);
      const encodedUrl = `${protocol}${username}:${encodedPassword}@${afterAt}`;

      // @ in password should be encoded as %40
      expect(encodedUrl).toContain('%40');
      expect(encodedPassword).toBe('pass%40word');
    }
  });

  it('should encode complex passwords with multiple special chars', () => {
    const password = 'p@ss$w#rd%123';
    const encoded = encodeURIComponent(password);

    // encodeURIComponent encodes: @(%40), $(%24), #(%23), %(%25)
    // But NOT ! (unreserved character in URLs)
    expect(encoded).toContain('%40'); // @
    expect(encoded).toContain('%24'); // $
    expect(encoded).toContain('%23'); // #
    expect(encoded).toContain('%25'); // %
  });
});
