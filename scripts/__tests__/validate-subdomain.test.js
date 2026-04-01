const { validateSubdomainName, RESERVED } = require('../validate');

describe('validateSubdomainName', () => {
  // =========================================================
  // 1. Valid subdomain names (should return empty array)
  // =========================================================
  describe('valid subdomain names', () => {
    it('accepts a standard valid name', () => {
      expect(validateSubdomainName('valid-name.json')).toEqual([]);
    });

    it('accepts minimum 2 characters', () => {
      expect(validateSubdomainName('ab.json')).toEqual([]);
    });

    it('accepts alphanumeric mix', () => {
      expect(validateSubdomainName('a1.json')).toEqual([]);
    });

    it('accepts multiple non-consecutive hyphens', () => {
      expect(validateSubdomainName('my-cool-site.json')).toEqual([]);
    });

    it('accepts exactly 63 characters (max length)', () => {
      const name = 'a' + 'b'.repeat(62) + '.json';
      expect(validateSubdomainName(name)).toEqual([]);
    });

    it('accepts letters + numbers mix', () => {
      expect(validateSubdomainName('test123.json')).toEqual([]);
    });

    it('accepts path prefix (as CI passes it)', () => {
      expect(validateSubdomainName('domains/valid-name.json')).toEqual([]);
    });
  });

  // =========================================================
  // 2. Invalid: uppercase letters
  // =========================================================
  describe('uppercase letters', () => {
    it('rejects names with uppercase and suggests lowercase', () => {
      const errors = validateSubdomainName('MyName.json');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('uppercase'))).toBe(true);
      expect(errors.some(e => e.includes('myname.json'))).toBe(true);
    });
  });

  // =========================================================
  // 3. Invalid: underscores
  // =========================================================
  describe('underscores', () => {
    it('rejects names with underscores and suggests hyphen replacement', () => {
      const errors = validateSubdomainName('my_site.json');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('underscore'))).toBe(true);
      expect(errors.some(e => e.includes('my-site.json'))).toBe(true);
    });
  });

  // =========================================================
  // 4. Invalid: dots (sub-subdomains)
  // =========================================================
  describe('dots', () => {
    it('rejects names with dots', () => {
      const errors = validateSubdomainName('my.site.json');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('dot'))).toBe(true);
    });
  });

  // =========================================================
  // 5. Invalid: spaces
  // =========================================================
  describe('spaces', () => {
    it('rejects names with spaces', () => {
      const errors = validateSubdomainName('my site.json');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('space'))).toBe(true);
    });
  });

  // =========================================================
  // 6. Invalid: special characters
  // =========================================================
  describe('special characters', () => {
    it('rejects names with invalid characters', () => {
      const errors = validateSubdomainName('my@site.json');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('invalid characters'))).toBe(true);
    });
  });

  // =========================================================
  // 7. Invalid: leading hyphen
  // =========================================================
  describe('leading hyphen', () => {
    it('rejects names starting with a hyphen', () => {
      const errors = validateSubdomainName('-mysite.json');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('starts with a hyphen'))).toBe(true);
    });
  });

  // =========================================================
  // 8. Invalid: trailing hyphen
  // =========================================================
  describe('trailing hyphen', () => {
    it('rejects names ending with a hyphen', () => {
      const errors = validateSubdomainName('mysite-.json');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('ends with a hyphen'))).toBe(true);
    });
  });

  // =========================================================
  // 9. Invalid: consecutive hyphens
  // =========================================================
  describe('consecutive hyphens', () => {
    it('rejects names with consecutive hyphens', () => {
      const errors = validateSubdomainName('my--site.json');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('consecutive hyphens'))).toBe(true);
    });
  });

  // =========================================================
  // 10. Invalid: too short
  // =========================================================
  describe('too short', () => {
    it('rejects single-character names', () => {
      const errors = validateSubdomainName('a.json');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('too short'))).toBe(true);
    });
  });

  // =========================================================
  // 11. Invalid: too long
  // =========================================================
  describe('too long', () => {
    it('rejects names exceeding 63 characters', () => {
      const name = 'a'.repeat(64) + '.json';
      const errors = validateSubdomainName(name);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('too long'))).toBe(true);
    });
  });

  // =========================================================
  // 12. Invalid: purely numeric
  // =========================================================
  describe('purely numeric', () => {
    it('rejects purely numeric names', () => {
      const errors = validateSubdomainName('12345.json');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('purely numeric'))).toBe(true);
    });
  });

  // =========================================================
  // 13. Invalid: reserved names
  // =========================================================
  describe('reserved names', () => {
    const reservedNames = ['www', 'api', 'admin', 'mail', 'test', 'is-a', 'tatsu'];

    it.each(reservedNames)('rejects reserved name "%s"', (name) => {
      const errors = validateSubdomainName(`${name}.json`);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('reserved'))).toBe(true);
    });
  });

  // =========================================================
  // 14. Multiple errors in single input
  // =========================================================
  describe('multiple errors', () => {
    it('returns errors for both uppercase and underscores', () => {
      const errors = validateSubdomainName('My_Site.json');
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors.some(e => e.includes('uppercase'))).toBe(true);
      expect(errors.some(e => e.includes('underscore'))).toBe(true);
    });
  });

  // =========================================================
  // 15. Non-.json extension
  // =========================================================
  describe('non-.json extension', () => {
    it('rejects files without .json extension', () => {
      const errors = validateSubdomainName('file.txt');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('.json'))).toBe(true);
    });
  });

  // =========================================================
  // 16. Empty filename
  // =========================================================
  describe('empty filename', () => {
    it('rejects .json with no name', () => {
      const errors = validateSubdomainName('.json');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('empty'))).toBe(true);
    });
  });
});
