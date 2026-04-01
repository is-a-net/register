const { validateDomainData } = require("../validate");

const makeData = (records, proxied) => ({
  owner: { username: "testuser", email: "test@example.com" },
  records,
  ...(proxied !== undefined && { proxied }),
});

// ─── MX records ─────────────────────────────────────────────
describe("MX records", () => {
  test("valid string entry returns no error", () => {
    expect(validateDomainData(makeData({ MX: ["mail.example.com"] }))).toEqual([]);
  });

  test("valid object entry with priority returns no error", () => {
    expect(
      validateDomainData(makeData({ MX: [{ target: "mail.example.com", priority: 10 }] }))
    ).toEqual([]);
  });

  test("valid mixed format (string + object) returns no error", () => {
    expect(
      validateDomainData(
        makeData({
          MX: ["mail1.example.com", { target: "mail2.example.com", priority: 20 }],
        })
      )
    ).toEqual([]);
  });

  test("empty array → error", () => {
    const errors = validateDomainData(makeData({ MX: [] }));
    expect(errors.some((e) => e.includes("non-empty array"))).toBe(true);
  });

  test("not an array → error", () => {
    const errors = validateDomainData(makeData({ MX: "mail.example.com" }));
    expect(errors.some((e) => e.includes("non-empty array"))).toBe(true);
  });

  test("invalid hostname → error", () => {
    const errors = validateDomainData(makeData({ MX: ["invalid"] }));
    expect(errors.some((e) => e.includes("Invalid MX target"))).toBe(true);
  });

  test("invalid priority (negative) → error", () => {
    const errors = validateDomainData(
      makeData({ MX: [{ target: "mail.example.com", priority: -1 }] })
    );
    expect(errors.some((e) => e.includes("Invalid MX priority"))).toBe(true);
  });

  test("invalid priority (70000) → error", () => {
    const errors = validateDomainData(
      makeData({ MX: [{ target: "mail.example.com", priority: 70000 }] })
    );
    expect(errors.some((e) => e.includes("Invalid MX priority"))).toBe(true);
  });

  test("invalid entry type (number) → error", () => {
    const errors = validateDomainData(makeData({ MX: [123] }));
    expect(errors.some((e) => e.includes("Invalid MX entry"))).toBe(true);
  });
});

// ─── TXT records ────────────────────────────────────────────
describe("TXT records", () => {
  test("valid string returns no error", () => {
    expect(
      validateDomainData(makeData({ TXT: "v=spf1 include:example.com ~all" }))
    ).toEqual([]);
  });

  test("valid array of strings returns no error", () => {
    expect(validateDomainData(makeData({ TXT: ["txt1", "txt2"] }))).toEqual([]);
  });

  test("empty array → error", () => {
    const errors = validateDomainData(makeData({ TXT: [] }));
    expect(errors.some((e) => e.includes("must not be empty"))).toBe(true);
  });

  test("non-string in array → error", () => {
    const errors = validateDomainData(makeData({ TXT: [123] }));
    expect(errors.some((e) => e.includes("Invalid TXT entry"))).toBe(true);
  });

  test("invalid type (number) → error", () => {
    const errors = validateDomainData(makeData({ TXT: 123 }));
    expect(errors.some((e) => e.includes("must be a string or array"))).toBe(true);
  });

  test("null → error", () => {
    const errors = validateDomainData(makeData({ TXT: null }));
    expect(errors.some((e) => e.includes("must be a string or array"))).toBe(true);
  });
});

// ─── NS records ─────────────────────────────────────────────
describe("NS records", () => {
  test("valid NS records return no error", () => {
    expect(
      validateDomainData(makeData({ NS: ["ns1.example.com", "ns2.example.com"] }))
    ).toEqual([]);
  });

  test("empty array → error", () => {
    const errors = validateDomainData(makeData({ NS: [] }));
    expect(errors.some((e) => e.includes("non-empty array"))).toBe(true);
  });

  test("not an array → error", () => {
    const errors = validateDomainData(makeData({ NS: "ns1.example.com" }));
    expect(errors.some((e) => e.includes("non-empty array"))).toBe(true);
  });

  test("invalid hostname → error", () => {
    const errors = validateDomainData(makeData({ NS: ["invalid"] }));
    expect(errors.some((e) => e.includes("Invalid NS target"))).toBe(true);
  });

  test("non-string entry → error", () => {
    const errors = validateDomainData(makeData({ NS: [123] }));
    expect(errors.some((e) => e.includes("Invalid NS target"))).toBe(true);
  });
});

// ─── CAA records ────────────────────────────────────────────
describe("CAA records", () => {
  test("valid issue tag returns no error", () => {
    expect(
      validateDomainData(makeData({ CAA: [{ tag: "issue", value: "letsencrypt.org" }] }))
    ).toEqual([]);
  });

  test("valid issuewild tag returns no error", () => {
    expect(
      validateDomainData(makeData({ CAA: [{ tag: "issuewild", value: ";" }] }))
    ).toEqual([]);
  });

  test("valid iodef tag returns no error", () => {
    expect(
      validateDomainData(
        makeData({ CAA: [{ tag: "iodef", value: "mailto:admin@example.com" }] })
      )
    ).toEqual([]);
  });

  test("empty array → error", () => {
    const errors = validateDomainData(makeData({ CAA: [] }));
    expect(errors.some((e) => e.includes("non-empty array"))).toBe(true);
  });

  test("invalid tag → error", () => {
    const errors = validateDomainData(
      makeData({ CAA: [{ tag: "invalid", value: "test" }] })
    );
    expect(errors.some((e) => e.includes("Invalid CAA tag"))).toBe(true);
  });

  test("missing value → error", () => {
    const errors = validateDomainData(makeData({ CAA: [{ tag: "issue" }] }));
    expect(errors.some((e) => e.includes("'value' string"))).toBe(true);
  });

  test("not an object → error", () => {
    const errors = validateDomainData(makeData({ CAA: ["string"] }));
    expect(errors.some((e) => e.includes("must be an object"))).toBe(true);
  });
});

// ─── DS records ─────────────────────────────────────────────
describe("DS records", () => {
  const validDS = { key_tag: 12345, algorithm: 8, digest_type: 2, digest: "abc123" };
  const validNS = ["ns1.example.com"];

  test("valid DS with NS returns no error", () => {
    expect(validateDomainData(makeData({ NS: validNS, DS: [validDS] }))).toEqual([]);
  });

  test("DS without NS → error", () => {
    const errors = validateDomainData(makeData({ DS: [validDS] }));
    expect(errors.some((e) => e.includes("DS") && e.includes("require NS"))).toBe(true);
  });

  test("invalid key_tag (negative) → error", () => {
    const errors = validateDomainData(
      makeData({ NS: validNS, DS: [{ ...validDS, key_tag: -1 }] })
    );
    expect(errors.some((e) => e.includes("Invalid DS key_tag"))).toBe(true);
  });

  test("missing digest → error", () => {
    const { digest, ...noDigest } = validDS;
    const errors = validateDomainData(makeData({ NS: validNS, DS: [noDigest] }));
    expect(errors.some((e) => e.includes("digest"))).toBe(true);
  });

  test("not an object → error", () => {
    const errors = validateDomainData(makeData({ NS: validNS, DS: ["string"] }));
    expect(errors.some((e) => e.includes("must be an object"))).toBe(true);
  });
});

// ─── SRV records ────────────────────────────────────────────
describe("SRV records", () => {
  const validSRV = { priority: 10, weight: 5, port: 5060, target: "sip.example.com" };

  test("valid SRV returns no error", () => {
    expect(validateDomainData(makeData({ SRV: [validSRV] }))).toEqual([]);
  });

  test("empty array → error", () => {
    const errors = validateDomainData(makeData({ SRV: [] }));
    expect(errors.some((e) => e.includes("non-empty array"))).toBe(true);
  });

  test("invalid priority (negative) → error", () => {
    const errors = validateDomainData(
      makeData({ SRV: [{ ...validSRV, priority: -1 }] })
    );
    expect(errors.some((e) => e.includes("Invalid SRV priority"))).toBe(true);
  });

  test("invalid port (70000) → error", () => {
    const errors = validateDomainData(
      makeData({ SRV: [{ ...validSRV, port: 70000 }] })
    );
    expect(errors.some((e) => e.includes("Invalid SRV port"))).toBe(true);
  });

  test("invalid target → error", () => {
    const errors = validateDomainData(
      makeData({ SRV: [{ priority: 10, weight: 5, port: 80, target: "invalid" }] })
    );
    expect(errors.some((e) => e.includes("Invalid SRV target"))).toBe(true);
  });

  test("not an object → error", () => {
    const errors = validateDomainData(makeData({ SRV: ["string"] }));
    expect(errors.some((e) => e.includes("must be an object"))).toBe(true);
  });
});

// ─── TLSA records ───────────────────────────────────────────
describe("TLSA records", () => {
  const validTLSA = { usage: 3, selector: 1, matching_type: 1, certificate: "abcd1234" };

  test("valid TLSA returns no error", () => {
    expect(validateDomainData(makeData({ TLSA: [validTLSA] }))).toEqual([]);
  });

  test("empty array → error", () => {
    const errors = validateDomainData(makeData({ TLSA: [] }));
    expect(errors.some((e) => e.includes("non-empty array"))).toBe(true);
  });

  test("invalid usage (4) → error", () => {
    const errors = validateDomainData(
      makeData({ TLSA: [{ ...validTLSA, usage: 4 }] })
    );
    expect(errors.some((e) => e.includes("Invalid TLSA usage"))).toBe(true);
  });

  test("invalid selector (2) → error", () => {
    const errors = validateDomainData(
      makeData({ TLSA: [{ ...validTLSA, selector: 2 }] })
    );
    expect(errors.some((e) => e.includes("Invalid TLSA selector"))).toBe(true);
  });

  test("invalid matching_type (3) → error", () => {
    const errors = validateDomainData(
      makeData({ TLSA: [{ ...validTLSA, matching_type: 3 }] })
    );
    expect(errors.some((e) => e.includes("Invalid TLSA matching_type"))).toBe(true);
  });

  test("missing certificate → error", () => {
    const { certificate, ...noCert } = validTLSA;
    const errors = validateDomainData(makeData({ TLSA: [noCert] }));
    expect(errors.some((e) => e.includes("certificate"))).toBe(true);
  });

  test("not an object → error", () => {
    const errors = validateDomainData(makeData({ TLSA: ["string"] }));
    expect(errors.some((e) => e.includes("must be an object"))).toBe(true);
  });
});

// ─── URL records ────────────────────────────────────────────
describe("URL records", () => {
  test("valid http URL returns no error", () => {
    expect(validateDomainData(makeData({ URL: "http://example.com" }))).toEqual([]);
  });

  test("valid https URL with path returns no error", () => {
    expect(
      validateDomainData(makeData({ URL: "https://example.com/path" }))
    ).toEqual([]);
  });

  test("ftp URL → error", () => {
    const errors = validateDomainData(makeData({ URL: "ftp://example.com" }));
    expect(errors.some((e) => e.includes("Invalid URL redirect"))).toBe(true);
  });

  test("not a URL → error", () => {
    const errors = validateDomainData(makeData({ URL: "not-a-url" }));
    expect(errors.some((e) => e.includes("Invalid URL redirect"))).toBe(true);
  });

  test("not a string → error", () => {
    const errors = validateDomainData(makeData({ URL: 123 }));
    expect(errors.some((e) => e.includes("Invalid URL redirect"))).toBe(true);
  });

  test("self-referencing is-a.net → error", () => {
    const errors = validateDomainData(
      makeData({ URL: "https://example.is-a.net" })
    );
    expect(errors.some((e) => e.includes("self-referencing"))).toBe(true);
  });
});

// ─── Record combination rules ───────────────────────────────
describe("Record combination rules", () => {
  test("CNAME + A → error", () => {
    const errors = validateDomainData(
      makeData({ CNAME: "example.com", A: ["1.1.1.1"] })
    );
    expect(
      errors.some((e) => e.includes("CNAME") && e.includes("cannot be combined"))
    ).toBe(true);
  });

  test("CNAME + AAAA → error", () => {
    const errors = validateDomainData(
      makeData({ CNAME: "example.com", AAAA: ["2001:db8::1"] })
    );
    expect(
      errors.some((e) => e.includes("CNAME") && e.includes("cannot be combined"))
    ).toBe(true);
  });

  test("NS + A → error about NS combination", () => {
    const errors = validateDomainData(
      makeData({ NS: ["ns1.example.com"], A: ["1.1.1.1"] })
    );
    expect(
      errors.some((e) => e.includes("NS") && e.includes("only be combined with DS"))
    ).toBe(true);
  });

  test("NS + DS → no error", () => {
    expect(
      validateDomainData(
        makeData({
          NS: ["ns1.example.com"],
          DS: [{ key_tag: 12345, algorithm: 8, digest_type: 2, digest: "abc" }],
        })
      )
    ).toEqual([]);
  });

  test("URL + A → error", () => {
    const errors = validateDomainData(
      makeData({ URL: "https://example.com", A: ["1.1.1.1"] })
    );
    expect(
      errors.some((e) => e.includes("URL") && e.includes("cannot be combined"))
    ).toBe(true);
  });

  test("URL + CNAME → error", () => {
    const errors = validateDomainData(
      makeData({ URL: "https://example.com", CNAME: "example.com" })
    );
    expect(
      errors.some((e) => e.includes("URL") && e.includes("cannot be combined"))
    ).toBe(true);
  });

  test("CNAME + MX → error", () => {
    const errors = validateDomainData(
      makeData({ CNAME: "example.com", MX: ["mail.example.com"] })
    );
    expect(
      errors.some((e) => e.includes("CNAME") && e.includes("cannot be combined"))
    ).toBe(true);
  });

  test("CNAME + TXT → error", () => {
    const errors = validateDomainData(
      makeData({ CNAME: "example.com", TXT: "v=spf1 ~all" })
    );
    expect(
      errors.some((e) => e.includes("CNAME") && e.includes("cannot be combined"))
    ).toBe(true);
  });
});

// ─── Proxied flag ───────────────────────────────────────────
describe("proxied flag", () => {
  // Valid cases
  test("proxied: true with A record → no error", () => {
    expect(validateDomainData(makeData({ A: ["1.1.1.1"] }, true))).toEqual([]);
  });

  test("proxied: true with AAAA record → no error", () => {
    expect(validateDomainData(makeData({ AAAA: ["2001:db8::1"] }, true))).toEqual([]);
  });

  test("proxied: true with CNAME record → no error", () => {
    expect(validateDomainData(makeData({ CNAME: "example.com" }, true))).toEqual([]);
  });

  test("proxied: false with any record → no error", () => {
    expect(validateDomainData(makeData({ A: ["1.1.1.1"] }, false))).toEqual([]);
  });

  test("no proxied field at all → no error", () => {
    expect(validateDomainData(makeData({ A: ["1.1.1.1"] }))).toEqual([]);
  });

  // Invalid cases
  test("proxied: true with MX record → error", () => {
    const errors = validateDomainData(makeData({ MX: ["mail.example.com"] }, true));
    expect(errors.some((e) => e.includes("can only be used with A, AAAA, or CNAME"))).toBe(true);
  });

  test("proxied: true with TXT record → error", () => {
    const errors = validateDomainData(makeData({ TXT: "v=spf1 ~all" }, true));
    expect(errors.some((e) => e.includes("can only be used with A, AAAA, or CNAME"))).toBe(true);
  });

  test("proxied: true with NS record → error", () => {
    const errors = validateDomainData(makeData({ NS: ["ns1.example.com"] }, true));
    expect(errors.some((e) => e.includes("can only be used with A, AAAA, or CNAME"))).toBe(true);
  });

  test("proxied: 'yes' (string) → error", () => {
    const errors = validateDomainData(makeData({ A: ["1.1.1.1"] }, "yes"));
    expect(errors.some((e) => e.includes("'proxied' must be a boolean"))).toBe(true);
  });

  test("proxied: 1 (number) → error", () => {
    const errors = validateDomainData(makeData({ A: ["1.1.1.1"] }, 1));
    expect(errors.some((e) => e.includes("'proxied' must be a boolean"))).toBe(true);
  });

  test("proxied: null → error", () => {
    const errors = validateDomainData(makeData({ A: ["1.1.1.1"] }, null));
    expect(errors.some((e) => e.includes("'proxied' must be a boolean"))).toBe(true);
  });
});
