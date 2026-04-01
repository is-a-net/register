const { isPrivateIPv4, RESERVED, ALLOWED_RECORD_TYPES } = require('../validate');

// ============================================================
// isPrivateIPv4
// ============================================================
describe('isPrivateIPv4', () => {
  describe('private IPs (should return true)', () => {
    const privateCases = [
      ['10.0.0.1', '10.x.x.x range'],
      ['10.255.255.255', '10.x range max'],
      ['192.168.0.1', '192.168.x.x range'],
      ['192.168.255.255', '192.168.x range max'],
      ['172.16.0.1', '172.16-31.x.x range start'],
      ['172.31.255.255', '172.16-31 range end'],
      ['172.20.0.1', '172 mid-range'],
      ['127.0.0.1', 'loopback'],
      ['127.255.255.255', 'loopback range max'],
      ['0.0.0.0', 'zero prefix'],
      ['0.1.2.3', 'zero prefix'],
      ['169.254.1.1', 'link-local'],
    ];

    test.each(privateCases)('%s — %s', (ip) => {
      expect(isPrivateIPv4(ip)).toBe(true);
    });
  });

  describe('public IPs (should return false)', () => {
    const publicCases = [
      ['8.8.8.8', 'Google DNS'],
      ['1.1.1.1', 'Cloudflare DNS'],
      ['203.0.113.1', 'documentation range (not in PRIVATE_IPV4_PREFIXES)'],
      ['172.15.0.1', 'just below 172.16 range (NOT private)'],
      ['172.32.0.1', 'just above 172.31 range (NOT private)'],
      ['11.0.0.1', 'just above 10.x range'],
      ['168.254.1.1', 'NOT 169.254 (not link-local)'],
      ['192.167.1.1', 'NOT 192.168'],
      ['128.0.0.1', 'NOT 127.x'],
      ['255.255.255.255', 'broadcast (not in private list)'],
    ];

    test.each(publicCases)('%s — %s', (ip) => {
      expect(isPrivateIPv4(ip)).toBe(false);
    });
  });

  describe('edge cases for 172.16-31 range', () => {
    test('172.16.0.0 → true (start of range)', () => {
      expect(isPrivateIPv4('172.16.0.0')).toBe(true);
    });

    test('172.31.255.255 → true (end of range)', () => {
      expect(isPrivateIPv4('172.31.255.255')).toBe(true);
    });

    test('172.15.255.255 → false (just below)', () => {
      expect(isPrivateIPv4('172.15.255.255')).toBe(false);
    });

    test('172.32.0.0 → false (just above)', () => {
      expect(isPrivateIPv4('172.32.0.0')).toBe(false);
    });
  });
});

// ============================================================
// RESERVED set
// ============================================================
describe('RESERVED set', () => {
  describe('contains expected reserved names', () => {
    const expectedReserved = [
      'www', 'mail', 'api', 'admin', 'ftp', 'ssh', 'cdn', 'blog',
      'auth', 'login', 'root', 'test', 'dev', 'staging', 'prod',
      'is-a', 'tatsu',
    ];

    test.each(expectedReserved)('contains "%s"', (name) => {
      expect(RESERVED.has(name)).toBe(true);
    });
  });

  describe('does NOT contain valid subdomain names', () => {
    const notReserved = ['myapp', 'cool-site', 'github-project'];

    test.each(notReserved)('does not contain "%s"', (name) => {
      expect(RESERVED.has(name)).toBe(false);
    });
  });

  test('total count is greater than 100', () => {
    expect(RESERVED.size).toBeGreaterThan(100);
  });
});

// ============================================================
// ALLOWED_RECORD_TYPES
// ============================================================
describe('ALLOWED_RECORD_TYPES', () => {
  describe('contains expected types', () => {
    test.each(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'CAA', 'DS', 'SRV', 'TLSA', 'URL'])('includes "%s"', (type) => {
      expect(ALLOWED_RECORD_TYPES).toContain(type);
    });

    test('has exactly 11 elements', () => {
      expect(ALLOWED_RECORD_TYPES).toHaveLength(11);
    });
  });

  describe('does NOT contain unsupported types', () => {
    test.each(['SPF', 'PTR', 'SOA', 'NAPTR'])('does not include "%s"', (type) => {
      expect(ALLOWED_RECORD_TYPES).not.toContain(type);
    });
  });
});
