const { validateDomainData } = require("../validate");

const validData = () => ({
  owner: { username: "testuser", email: "test@example.com" },
  records: { CNAME: "example.github.io" },
});

// ─── 1. Valid data (happy paths) ────────────────────────────────
describe("Valid data (happy paths)", () => {
  test("valid CNAME record returns no errors", () => {
    expect(validateDomainData(validData())).toEqual([]);
  });

  test("valid A record with 1 IP returns no errors", () => {
    const data = validData();
    data.records = { A: ["8.8.8.8"] };
    expect(validateDomainData(data)).toEqual([]);
  });

  test("valid A record with 4 IPs returns no errors", () => {
    const data = validData();
    data.records = { A: ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"] };
    expect(validateDomainData(data)).toEqual([]);
  });

  test("valid AAAA record returns no errors", () => {
    const data = validData();
    data.records = { AAAA: ["2001:db8::1"] };
    expect(validateDomainData(data)).toEqual([]);
  });
});

// ─── 2. Root structure validation ───────────────────────────────
describe("Root structure validation", () => {
  test.each([
    ["null", null],
    ["array", []],
    ["string", "string"],
    ["number", 42],
  ])("%s → error 'Root must be a JSON object'", (_label, input) => {
    const errors = validateDomainData(input);
    expect(errors).toContainEqual("Root must be a JSON object");
  });
});

// ─── 3. Unknown top-level keys ──────────────────────────────────
describe("Unknown top-level keys", () => {
  test("extra key produces error about unknown key", () => {
    const data = { ...validData(), extra: "value" };
    const errors = validateDomainData(data);
    expect(errors).toContainEqual('Unknown top-level key: "extra"');
  });
});

// ─── 4. Owner validation ────────────────────────────────────────
describe("Owner validation", () => {
  test("missing owner entirely → error", () => {
    const { owner, ...rest } = validData();
    const errors = validateDomainData(rest);
    expect(errors).toContainEqual("Missing or invalid 'owner' field");
  });

  test("owner: null → error", () => {
    const data = validData();
    data.owner = null;
    const errors = validateDomainData(data);
    expect(errors).toContainEqual("Missing or invalid 'owner' field");
  });

  test("owner: string → error", () => {
    const data = validData();
    data.owner = "string";
    const errors = validateDomainData(data);
    expect(errors).toContainEqual("Missing or invalid 'owner' field");
  });

  test("missing username → error about username", () => {
    const data = validData();
    delete data.owner.username;
    const errors = validateDomainData(data);
    expect(errors).toContainEqual(
      "Invalid or missing 'owner.username' (must be a valid GitHub username)"
    );
  });

  test("invalid username (-invalid) → error about username", () => {
    const data = validData();
    data.owner.username = "-invalid";
    const errors = validateDomainData(data);
    expect(errors).toContainEqual(
      "Invalid or missing 'owner.username' (must be a valid GitHub username)"
    );
  });

  test("missing email → error about email", () => {
    const data = validData();
    delete data.owner.email;
    const errors = validateDomainData(data);
    expect(errors).toContainEqual("Invalid or missing 'owner.email'");
  });

  test("invalid email (notanemail) → error about email", () => {
    const data = validData();
    data.owner.email = "notanemail";
    const errors = validateDomainData(data);
    expect(errors).toContainEqual("Invalid or missing 'owner.email'");
  });

  test.each(["user-name", "a", "user123"])(
    "valid GitHub username '%s' → no owner errors",
    (username) => {
      const data = validData();
      data.owner.username = username;
      const errors = validateDomainData(data);
      expect(errors).toEqual([]);
    }
  );
});

// ─── 5. Records validation ──────────────────────────────────────
describe("Records validation", () => {
  test("missing records → error", () => {
    const data = validData();
    delete data.records;
    const errors = validateDomainData(data);
    expect(errors).toContainEqual("Missing or invalid 'records' field");
  });

  test("records: null → error", () => {
    const data = validData();
    data.records = null;
    const errors = validateDomainData(data);
    expect(errors).toContainEqual("Missing or invalid 'records' field");
  });

  test("records: {} (empty) → error 'at least one record type'", () => {
    const data = validData();
    data.records = {};
    const errors = validateDomainData(data);
    expect(errors).toContainEqual(
      "'records' must contain at least one record type"
    );
  });

  test("CNAME + A → error about combination", () => {
    const data = validData();
    data.records = { A: ["8.8.8.8"], CNAME: "example.github.io" };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("CNAME") && e.includes("cannot be combined"))).toBe(true);
  });

  test("unknown record type SPF → error about unknown type", () => {
    const data = validData();
    data.records = { SPF: "v=spf1" };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Unknown record type") && e.includes("SPF"))).toBe(true);
  });
});

// ─── 6. A records ───────────────────────────────────────────────
describe("A records", () => {
  test("empty array → error 'non-empty array'", () => {
    const data = validData();
    data.records = { A: [] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("non-empty array"))).toBe(true);
  });

  test("not an array (string) → error 'non-empty array'", () => {
    const data = validData();
    data.records = { A: "1.1.1.1" };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("non-empty array"))).toBe(true);
  });

  test("invalid IPv4 '256.1.1.1' → error 'Invalid IPv4'", () => {
    const data = validData();
    data.records = { A: ["256.1.1.1"] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Invalid IPv4"))).toBe(true);
  });

  test("invalid IPv4 '1.1.1' → error", () => {
    const data = validData();
    data.records = { A: ["1.1.1"] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Invalid IPv4"))).toBe(true);
  });

  test("non-string in array (123) → error", () => {
    const data = validData();
    data.records = { A: [123] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Invalid IPv4"))).toBe(true);
  });

  test("more than 4 addresses → error 'at most 4'", () => {
    const data = validData();
    data.records = {
      A: ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1", "4.4.4.4"],
    };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("at most 4"))).toBe(true);
  });

  test.each([
    ["10.0.0.1", "Private/reserved"],
    ["192.168.1.1", "Private/reserved"],
    ["172.16.0.1", "Private/reserved"],
    ["127.0.0.1", "Private/reserved"],
    ["169.254.1.1", "Private/reserved"],
    ["0.0.0.1", "Private/reserved"],
  ])("private IP %s → error '%s'", (ip, expectedFragment) => {
    const data = validData();
    data.records = { A: [ip] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes(expectedFragment))).toBe(true);
  });
});

// ─── 7. AAAA records ────────────────────────────────────────────
describe("AAAA records", () => {
  test("empty array → error", () => {
    const data = validData();
    data.records = { AAAA: [] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("non-empty array"))).toBe(true);
  });

  test("not an array → error", () => {
    const data = validData();
    data.records = { AAAA: "2001:db8::1" };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("non-empty array"))).toBe(true);
  });

  test("more than 4 → error", () => {
    const data = validData();
    data.records = {
      AAAA: [
        "2001:db8::1",
        "2001:db8::2",
        "2001:db8::3",
        "2001:db8::4",
        "2001:db8::5",
      ],
    };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("at most 4"))).toBe(true);
  });

  test("loopback ::1 → error 'Loopback'", () => {
    const data = validData();
    data.records = { AAAA: ["::1"] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Loopback"))).toBe(true);
  });

  test("unspecified :: → error 'Loopback'", () => {
    const data = validData();
    data.records = { AAAA: ["::"] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Loopback"))).toBe(true);
  });

  test("non-string (123) → error", () => {
    const data = validData();
    data.records = { AAAA: [123] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Invalid IPv6"))).toBe(true);
  });

  test("invalid IPv6 format string → error", () => {
    const data = validData();
    data.records = { AAAA: ["not-an-ip"] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Invalid IPv6"))).toBe(true);
  });

  test("invalid IPv6 format 'abc.def.ghi.jkl' → error", () => {
    const data = validData();
    data.records = { AAAA: ["abc.def.ghi.jkl"] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Invalid IPv6"))).toBe(true);
  });

  test("IPv4 address in AAAA → error", () => {
    const data = validData();
    data.records = { AAAA: ["1.2.3.4"] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Invalid IPv6"))).toBe(true);
  });

  test("valid IPv4-mapped IPv6 '::ffff:192.0.2.128' → no error", () => {
    const data = validData();
    data.records = { AAAA: ["::ffff:192.0.2.128"] };
    expect(validateDomainData(data)).toEqual([]);
  });

  test("valid full IPv6 '2001:0db8:0000:0000:0000:0000:0000:0001' → no error", () => {
    const data = validData();
    data.records = { AAAA: ["2001:0db8:0000:0000:0000:0000:0000:0001"] };
    expect(validateDomainData(data)).toEqual([]);
  });

  test("valid IPv6 '2001:db8::1' → no error", () => {
    const data = validData();
    data.records = { AAAA: ["2001:db8::1"] };
    expect(validateDomainData(data)).toEqual([]);
  });
});

// ─── 8. CNAME records ───────────────────────────────────────────
describe("CNAME records", () => {
  test("empty string → error", () => {
    const data = validData();
    data.records = { CNAME: "" };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Invalid CNAME target"))).toBe(true);
  });

  test("no TLD ('invalid') → error", () => {
    const data = validData();
    data.records = { CNAME: "invalid" };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Invalid CNAME target"))).toBe(true);
  });

  test("array → error", () => {
    const data = validData();
    data.records = { CNAME: ["array"] };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Invalid CNAME target"))).toBe(true);
  });

  test("null → error", () => {
    const data = validData();
    data.records = { CNAME: null };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("Invalid CNAME target"))).toBe(true);
  });

  test("self-referencing 'example.is-a.net' → error 'self-referencing'", () => {
    const data = validData();
    data.records = { CNAME: "example.is-a.net" };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("self-referencing"))).toBe(true);
  });

  test("case-insensitive self-ref 'example.IS-A.NET' → error", () => {
    const data = validData();
    data.records = { CNAME: "example.IS-A.NET" };
    const errors = validateDomainData(data);
    expect(errors.some((e) => e.includes("self-referencing"))).toBe(true);
  });

  test("valid CNAME 'example.github.io' → no error", () => {
    const data = validData();
    data.records = { CNAME: "example.github.io" };
    expect(validateDomainData(data)).toEqual([]);
  });

  test("valid CNAME 'sub.domain.co.uk' → no error", () => {
    const data = validData();
    data.records = { CNAME: "sub.domain.co.uk" };
    expect(validateDomainData(data)).toEqual([]);
  });
});
