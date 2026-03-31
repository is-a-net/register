const fs = require("fs");
const path = require("path");

const DOMAINS_DIR = path.join(__dirname, "..", "domains");

// ============================================================
// Reserved subdomains
// Cloudflare で既に使用中、またはシステム用に予約されたもの
// ============================================================
const RESERVED = new Set([
  // Cloudflare / DNS infrastructure
  "www",
  "mail",
  "email",
  "webmail",
  "smtp",
  "imap",
  "pop",
  "pop3",
  "ftp",
  "sftp",
  "ssh",
  "ns",
  "ns1",
  "ns2",
  "ns3",
  "ns4",
  "dns",
  "dns1",
  "dns2",
  // Service infrastructure
  "api",
  "api1",
  "api2",
  "graphql",
  "rest",
  "admin",
  "dashboard",
  "panel",
  "cpanel",
  "whm",
  "status",
  "health",
  "monitor",
  "uptime",
  // Web / CDN
  "cdn",
  "assets",
  "static",
  "media",
  "img",
  "images",
  "js",
  "css",
  "fonts",
  "files",
  "download",
  "downloads",
  "upload",
  "uploads",
  // Content / branding
  "blog",
  "docs",
  "doc",
  "wiki",
  "help",
  "support",
  "forum",
  "community",
  "app",
  "web",
  "portal",
  "home",
  "landing",
  "about",
  "news",
  "store",
  "shop",
  // Authentication / account
  "auth",
  "oauth",
  "login",
  "signin",
  "signup",
  "register",
  "account",
  "accounts",
  "profile",
  "user",
  "users",
  "my",
  // Internal
  "schema",
  "test",
  "testing",
  "dev",
  "development",
  "staging",
  "stage",
  "prod",
  "production",
  "demo",
  "sandbox",
  "preview",
  "beta",
  "alpha",
  "canary",
  "internal",
  "private",
  "local",
  "localhost",
  // Abuse-prone
  "root",
  "administrator",
  "moderator",
  "mod",
  "owner",
  "system",
  "sysadmin",
  "security",
  "abuse",
  "postmaster",
  "hostmaster",
  "webmaster",
  "info",
  "noreply",
  "no-reply",
  "null",
  "undefined",
  "example",
  // is-a.net 固有
  "is-a",
  "isa",
  "tatsu",
  "this",
]);

// ============================================================
// Subdomain naming rules
// ============================================================
const VALID_CHARS_PATTERN = /^[a-z0-9-]+$/;       // 使用可能文字
const STARTS_WITH_HYPHEN = /^-/;                   // 先頭ハイフン
const ENDS_WITH_HYPHEN = /-$/;                     // 末尾ハイフン
const CONSECUTIVE_HYPHENS = /--/;                  // 連続ハイフン
const HAS_UPPERCASE = /[A-Z]/;                     // 大文字
const HAS_UNDERSCORE = /_/;                        // アンダースコア
const HAS_DOT = /\./;                              // ドット（サブサブドメイン）
const HAS_SPACE = /\s/;                            // スペース
const MIN_LENGTH = 2;
const MAX_LENGTH = 63;

// ============================================================
// Validation patterns
// ============================================================
const IPV4_PATTERN = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
const HOSTNAME_PATTERN =
  /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const GITHUB_USERNAME_PATTERN =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_RECORD_TYPES = ["A", "AAAA", "CNAME"];

// Blocked CNAME targets (abuse prevention)
const BLOCKED_CNAME_PATTERNS = [
  /\.is-a\.net$/i, // Self-referencing
];

// Blocked IP ranges (private / reserved)
const PRIVATE_IPV4_PREFIXES = [
  "0.",
  "10.",
  "127.",
  "169.254.",
  "192.168.",
];

function isPrivateIPv4(ip) {
  if (PRIVATE_IPV4_PREFIXES.some((prefix) => ip.startsWith(prefix))) return true;
  // 172.16.0.0 - 172.31.255.255
  const parts = ip.split(".");
  if (parts[0] === "172") {
    const second = parseInt(parts[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

// ============================================================
// File discovery
// ============================================================
function getAllDomainFiles() {
  return fs
    .readdirSync(DOMAINS_DIR)
    .filter((f) => f.endsWith(".json") && f !== "schema.json");
}

function getChangedFiles() {
  const changedFiles = process.env.CHANGED_FILES;
  if (changedFiles) {
    return changedFiles
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.startsWith("domains/") && f.endsWith(".json"))
      .filter((f) => !f.endsWith("schema.json"));
  }
  return getAllDomainFiles().map((f) => path.join("domains", f));
}

// ============================================================
// Build ownership map: username -> list of subdomain files
// ============================================================
function buildOwnershipMap() {
  const map = new Map(); // username -> [filename, ...]
  const allFiles = getAllDomainFiles();

  for (const file of allFiles) {
    const filePath = path.join(DOMAINS_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const username = data?.owner?.username?.toLowerCase();
      if (username) {
        if (!map.has(username)) map.set(username, []);
        map.get(username).push(file);
      }
    } catch {
      // Skip files with parse errors (will be caught during validation)
    }
  }
  return map;
}

// ============================================================
// Validators
// ============================================================
function validateSubdomainName(filename) {
  const errors = [];
  const basename = path.basename(filename);
  const name = path.basename(filename, ".json");

  // ---- Filename-level checks ----

  // ファイル名が .json で終わっていなければ無効
  if (!basename.endsWith(".json")) {
    errors.push(`File "${basename}" must have a .json extension.`);
    return errors;
  }

  // 空のファイル名 (.json だけ)
  if (name.length === 0) {
    errors.push(`Filename cannot be empty (got ".json").`);
    return errors;
  }

  // ---- Invalid filename examples (is-a.dev style) ----
  //
  //  ✗ My-Site.json      → 大文字を含む
  //  ✗ my_site.json      → アンダースコアを含む
  //  ✗ -mysite.json      → 先頭がハイフン
  //  ✗ mysite-.json      → 末尾がハイフン
  //  ✗ my--site.json     → 連続ハイフン
  //  ✗ my site.json      → スペースを含む
  //  ✗ my.site.json      → ドットを含む（サブサブドメイン）
  //  ✗ 12345.json        → 数字のみ
  //  ✗ a.json            → 短すぎる（2文字未満）

  if (HAS_SPACE.test(name)) {
    errors.push(
      `"${name}" contains spaces. Spaces are not allowed in subdomain names.`
    );
  }

  if (HAS_UPPERCASE.test(name)) {
    errors.push(
      `"${name}" contains uppercase letters. Subdomain names must be all lowercase. ` +
        `Rename to "${name.toLowerCase()}.json".`
    );
  }

  if (HAS_UNDERSCORE.test(name)) {
    errors.push(
      `"${name}" contains underscores. Use hyphens (-) instead of underscores (_). ` +
        `Rename to "${name.replace(/_/g, "-")}.json".`
    );
  }

  if (HAS_DOT.test(name)) {
    errors.push(
      `"${name}" contains dots. Sub-subdomains (e.g. "a.b.is-a.net") are not supported.`
    );
  }

  if (!VALID_CHARS_PATTERN.test(name.toLowerCase())) {
    errors.push(
      `"${name}" contains invalid characters. Only lowercase letters (a-z), numbers (0-9), and hyphens (-) are allowed.`
    );
  }

  if (STARTS_WITH_HYPHEN.test(name)) {
    errors.push(
      `"${name}" starts with a hyphen. Subdomain names cannot begin with a hyphen.`
    );
  }

  if (ENDS_WITH_HYPHEN.test(name)) {
    errors.push(
      `"${name}" ends with a hyphen. Subdomain names cannot end with a hyphen.`
    );
  }

  if (CONSECUTIVE_HYPHENS.test(name)) {
    errors.push(
      `"${name}" contains consecutive hyphens (--). Use a single hyphen.`
    );
  }

  if (name.length < MIN_LENGTH) {
    errors.push(
      `"${name}" is too short (${name.length} char). Minimum length is ${MIN_LENGTH} characters.`
    );
  }

  if (name.length > MAX_LENGTH) {
    errors.push(
      `"${name}" is too long (${name.length} chars). Maximum length is ${MAX_LENGTH} characters.`
    );
  }

  if (/^\d+$/.test(name)) {
    errors.push(
      `"${name}" is purely numeric. Subdomain names must contain at least one letter.`
    );
  }

  if (RESERVED.has(name.toLowerCase())) {
    errors.push(`"${name}" is reserved and cannot be registered.`);
  }

  return errors;
}

function validateDomainData(data) {
  const errors = [];

  // Check top-level structure
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    errors.push("Root must be a JSON object");
    return errors;
  }

  const allowedKeys = new Set(["owner", "records"]);
  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown top-level key: "${key}"`);
    }
  }

  // Validate owner
  if (!data.owner || typeof data.owner !== "object") {
    errors.push("Missing or invalid 'owner' field");
  } else {
    if (
      !data.owner.username ||
      !GITHUB_USERNAME_PATTERN.test(data.owner.username)
    ) {
      errors.push(
        "Invalid or missing 'owner.username' (must be a valid GitHub username)"
      );
    }
    if (!data.owner.email || !EMAIL_PATTERN.test(data.owner.email)) {
      errors.push("Invalid or missing 'owner.email'");
    }
  }

  // Validate records
  if (!data.records || typeof data.records !== "object") {
    errors.push("Missing or invalid 'records' field");
    return errors;
  }

  const recordKeys = Object.keys(data.records);
  if (recordKeys.length === 0) {
    errors.push("'records' must contain at least one record type");
    return errors;
  }
  if (recordKeys.length > 1) {
    errors.push("'records' must contain exactly one record type");
  }

  for (const key of recordKeys) {
    if (!ALLOWED_RECORD_TYPES.includes(key)) {
      errors.push(
        `Unknown record type: "${key}". Allowed: ${ALLOWED_RECORD_TYPES.join(", ")}`
      );
      continue;
    }

    const value = data.records[key];

    if (key === "A") {
      if (!Array.isArray(value) || value.length === 0) {
        errors.push("'A' records must be a non-empty array of IPv4 addresses");
      } else {
        if (value.length > 4) {
          errors.push("'A' records can have at most 4 addresses");
        }
        for (const ip of value) {
          if (typeof ip !== "string" || !IPV4_PATTERN.test(ip)) {
            errors.push(`Invalid IPv4 address: "${ip}"`);
          } else if (isPrivateIPv4(ip)) {
            errors.push(
              `Private/reserved IPv4 address not allowed: "${ip}"`
            );
          }
        }
      }
    }

    if (key === "AAAA") {
      if (!Array.isArray(value) || value.length === 0) {
        errors.push(
          "'AAAA' records must be a non-empty array of IPv6 addresses"
        );
      } else {
        if (value.length > 4) {
          errors.push("'AAAA' records can have at most 4 addresses");
        }
        for (const ip of value) {
          if (typeof ip !== "string") {
            errors.push(`Invalid IPv6 address: "${ip}"`);
          }
          // Block loopback
          if (ip === "::1" || ip === "::") {
            errors.push(`Loopback/unspecified IPv6 address not allowed: "${ip}"`);
          }
        }
      }
    }

    if (key === "CNAME") {
      if (typeof value !== "string" || !HOSTNAME_PATTERN.test(value)) {
        errors.push(
          `Invalid CNAME target: "${value}". Must be a valid hostname.`
        );
      } else {
        for (const pattern of BLOCKED_CNAME_PATTERNS) {
          if (pattern.test(value)) {
            errors.push(
              `CNAME target "${value}" is not allowed (self-referencing).`
            );
          }
        }
      }
    }
  }

  return errors;
}

function validateOwnershipLimit(filename, data, ownershipMap) {
  const errors = [];
  if (!data?.owner?.username) return errors;

  const username = data.owner.username.toLowerCase();
  const ownedFiles = ownershipMap.get(username) || [];
  const currentFile = path.basename(filename);

  // Filter out the current file (in case of edits)
  const otherFiles = ownedFiles.filter((f) => f !== currentFile);

  const MAX_DOMAINS_PER_USER = 1;
  if (otherFiles.length >= MAX_DOMAINS_PER_USER) {
    errors.push(
      `User "${data.owner.username}" already owns ${otherFiles.length} subdomain(s): ${otherFiles.join(", ")}. ` +
        `Maximum ${MAX_DOMAINS_PER_USER} per user.`
    );
  }

  return errors;
}

function validatePRAuthor(filename, data) {
  const errors = [];
  const prAuthor = process.env.PR_AUTHOR;
  if (!prAuthor || !data?.owner?.username) return errors;

  // PR の送信者と owner.username が一致するか確認
  if (prAuthor.toLowerCase() !== data.owner.username.toLowerCase()) {
    errors.push(
      `PR author "${prAuthor}" does not match owner.username "${data.owner.username}". ` +
        `You can only register subdomains for yourself.`
    );
  }

  return errors;
}

// ============================================================
// Main
// ============================================================
function main() {
  const files = getChangedFiles();
  if (files.length === 0) {
    console.log("No domain files to validate.");
    process.exit(0);
  }

  const ownershipMap = buildOwnershipMap();
  let hasErrors = false;

  for (const file of files) {
    const filePath = path.resolve(__dirname, "..", file);
    console.log(`\nValidating: ${file}`);

    // 1. Check subdomain name
    const nameErrors = validateSubdomainName(file);
    if (nameErrors.length > 0) {
      hasErrors = true;
      nameErrors.forEach((e) => console.error(`  ✗ ${e}`));
      continue;
    }

    // 2. Check JSON syntax
    let data;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(raw);
    } catch (e) {
      hasErrors = true;
      console.error(`  ✗ Invalid JSON: ${e.message}`);
      continue;
    }

    // 3. Validate structure and values
    const dataErrors = validateDomainData(data);
    if (dataErrors.length > 0) {
      hasErrors = true;
      dataErrors.forEach((e) => console.error(`  ✗ ${e}`));
      continue;
    }

    // 4. Check ownership limit (1 user = 1 subdomain)
    const ownerErrors = validateOwnershipLimit(file, data, ownershipMap);
    if (ownerErrors.length > 0) {
      hasErrors = true;
      ownerErrors.forEach((e) => console.error(`  ✗ ${e}`));
      continue;
    }

    // 5. Check PR author matches owner (CI only)
    const prErrors = validatePRAuthor(file, data);
    if (prErrors.length > 0) {
      hasErrors = true;
      prErrors.forEach((e) => console.error(`  ✗ ${e}`));
      continue;
    }

    console.log(`  ✓ Valid`);
  }

  if (hasErrors) {
    console.error("\nValidation failed. Please fix the errors above.");
    process.exit(1);
  }

  console.log("\nAll files validated successfully.");
}

main();
