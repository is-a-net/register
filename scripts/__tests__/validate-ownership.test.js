const { validateOwnershipLimit, validatePRAuthor } = require('../validate');

describe('validateOwnershipLimit', () => {
  test('first domain for user (should pass)', () => {
    const ownershipMap = new Map();
    const errors = validateOwnershipLimit("newapp.json", { owner: { username: "alice" } }, ownershipMap);
    expect(errors).toEqual([]);
  });

  test('user already owns 1 domain (should fail)', () => {
    const ownershipMap = new Map([["bob", ["app1.json"]]]);
    const errors = validateOwnershipLimit("app2.json", { owner: { username: "bob" } }, ownershipMap);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("already owns");
  });

  test('user editing own domain (should pass - file is filtered out)', () => {
    const ownershipMap = new Map([["charlie", ["app1.json"]]]);
    const errors = validateOwnershipLimit("app1.json", { owner: { username: "charlie" } }, ownershipMap);
    expect(errors).toEqual([]);
  });

  test('case-insensitive username', () => {
    const ownershipMap = new Map([["david", ["app1.json"]]]);
    const errors = validateOwnershipLimit("app2.json", { owner: { username: "David" } }, ownershipMap);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('missing username in data (should return empty)', () => {
    const errors = validateOwnershipLimit("app.json", {}, new Map());
    expect(errors).toEqual([]);
  });

  test('null owner (should return empty)', () => {
    const errors = validateOwnershipLimit("app.json", { owner: null }, new Map());
    expect(errors).toEqual([]);
  });

  test('with path prefix (domains/app2.json) uses basename', () => {
    const ownershipMap = new Map([["eve", ["app1.json"]]]);
    const errors = validateOwnershipLimit("domains/app2.json", { owner: { username: "eve" } }, ownershipMap);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("already owns");
  });
});

describe('validatePRAuthor', () => {
  let originalPRAuthor;

  beforeEach(() => {
    originalPRAuthor = process.env.PR_AUTHOR;
  });

  afterEach(() => {
    if (originalPRAuthor === undefined) {
      delete process.env.PR_AUTHOR;
    } else {
      process.env.PR_AUTHOR = originalPRAuthor;
    }
  });

  test('matching author (should pass)', () => {
    process.env.PR_AUTHOR = "alice";
    const errors = validatePRAuthor("app.json", { owner: { username: "alice" } });
    expect(errors).toEqual([]);
  });

  test('non-matching author (should fail)', () => {
    process.env.PR_AUTHOR = "bob";
    const errors = validatePRAuthor("app.json", { owner: { username: "alice" } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("does not match");
  });

  test('case-insensitive comparison', () => {
    process.env.PR_AUTHOR = "Alice";
    const errors = validatePRAuthor("app.json", { owner: { username: "alice" } });
    expect(errors).toEqual([]);
  });

  test('no PR_AUTHOR env var (skip check)', () => {
    delete process.env.PR_AUTHOR;
    const errors = validatePRAuthor("app.json", { owner: { username: "alice" } });
    expect(errors).toEqual([]);
  });

  test('missing owner data (skip check)', () => {
    process.env.PR_AUTHOR = "alice";
    const errors = validatePRAuthor("app.json", {});
    expect(errors).toEqual([]);
  });
});
