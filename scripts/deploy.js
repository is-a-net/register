const fs = require("fs");
const path = require("path");

const DOMAINS_DIR = path.join(__dirname, "..", "domains");
const CF_API_BASE = "https://api.cloudflare.com/client/v4";

// Environment variables (set via GitHub Secrets)
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ZONE_ID = process.env.CF_ZONE_ID;
const BASE_DOMAIN = "is-a.net";

// Subdomains explicitly managed outside domain JSON files (infrastructure, manual Cloudflare records)
// These are NEVER deleted by orphaned record cleanup.
// Note: underscore-prefixed subdomains (_dmarc, _acme-challenge, _domainkey, etc.) are also
// always skipped via pattern check below — no need to list them here.
const PROTECTED_SUBDOMAINS = new Set([
  "this",    // Landing page (CNAME → is-a-net.github.io)
  "www",     // Potential www redirect
  "api",     // API endpoint
  "mail",    // Mail infrastructure
  "smtp",    // Mail infrastructure
  "imap",    // Mail infrastructure
  "pop",     // Mail infrastructure
]);

// Reserved names mirrored from validate.js — cannot be registered as user subdomains,
// so any DNS records for these are infrastructure records we must never delete.
const RESERVED_SUBDOMAINS = new Set([
  "www", "mail", "email", "webmail", "smtp", "imap", "pop", "pop3",
  "ftp", "sftp", "ssh", "ns", "ns1", "ns2", "ns3", "ns4", "dns", "dns1", "dns2",
  "api", "api1", "api2", "graphql", "rest", "admin", "dashboard", "panel",
  "cpanel", "whm", "status", "health", "monitor", "uptime",
  "cdn", "assets", "static", "media", "img", "images", "js", "css", "fonts",
  "files", "download", "downloads", "upload", "uploads",
  "blog", "docs", "doc", "wiki", "help", "support", "forum", "community",
  "app", "web", "portal", "home", "landing", "about", "news", "store", "shop",
  "auth", "oauth", "login", "signin", "signup", "register", "account", "accounts",
  "profile", "user", "users", "my",
  "schema", "test", "testing", "dev", "development", "staging", "stage",
  "prod", "production", "demo", "sandbox", "preview", "beta", "alpha", "canary",
  "internal", "private", "local", "localhost",
  "root", "administrator", "moderator", "mod", "owner", "system", "sysadmin",
  "security", "abuse", "postmaster", "hostmaster", "webmaster", "info",
  "noreply", "no-reply", "null", "undefined", "example",
  "is-a", "isa", "tatsu", "this",
]);

if (!CF_API_TOKEN || !CF_ZONE_ID) {
  console.error("Missing required environment variables: CF_API_TOKEN, CF_ZONE_ID");
  process.exit(1);
}

async function cfRequest(method, endpoint, body = null) {
  const url = `${CF_API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json();

  if (!data.success) {
    throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors)}`);
  }
  return data;
}

async function listExistingRecords(name) {
  const data = await cfRequest(
    "GET",
    `/zones/${CF_ZONE_ID}/dns_records?name=${name}.${BASE_DOMAIN}`
  );
  return data.result || [];
}

async function createRecord(name, type, content, proxied = false, priority = undefined) {
  console.log(`  Creating ${type} record: ${name}.${BASE_DOMAIN} -> ${content}`);
  const body = {
    type,
    name: `${name}.${BASE_DOMAIN}`,
    content,
    proxied,
    ttl: 1,
  };
  if (priority !== undefined) body.priority = priority;
  return cfRequest("POST", `/zones/${CF_ZONE_ID}/dns_records`, body);
}

async function createRecordWithData(name, type, data, proxied = false) {
  console.log(`  Creating ${type} record: ${name}.${BASE_DOMAIN}`);
  return cfRequest("POST", `/zones/${CF_ZONE_ID}/dns_records`, {
    type,
    name: `${name}.${BASE_DOMAIN}`,
    data,
    proxied,
    ttl: 1,
  });
}

async function deleteRecord(recordId) {
  return cfRequest("DELETE", `/zones/${CF_ZONE_ID}/dns_records/${recordId}`);
}

async function deployDomain(filename) {
  const name = path.basename(filename, ".json");
  const filePath = path.join(DOMAINS_DIR, filename);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const records = data.records;
  const proxied = data.proxied === true;

  console.log(`\nDeploying: ${name}.${BASE_DOMAIN}`);

  // Snapshot existing records before touching anything
  const existing = await listExistingRecords(name);

  // Phase 1: Create all new records first, collecting IDs for rollback on failure
  const createdIds = [];
  try {
    if (records.A) {
      for (const ip of records.A) {
        const res = await createRecord(name, "A", ip, proxied);
        createdIds.push(res.result.id);
      }
    }

    if (records.AAAA) {
      for (const ip of records.AAAA) {
        const res = await createRecord(name, "AAAA", ip, proxied);
        createdIds.push(res.result.id);
      }
    }

    if (records.CNAME) {
      const res = await createRecord(name, "CNAME", records.CNAME, proxied);
      createdIds.push(res.result.id);
    }

    if (records.MX) {
      for (const entry of records.MX) {
        const target = typeof entry === "string" ? entry : entry.target;
        const priority = typeof entry === "object" ? (entry.priority || 10) : 10;
        const res = await createRecord(name, "MX", target, false, priority);
        createdIds.push(res.result.id);
      }
    }

    if (records.TXT) {
      const txtEntries = Array.isArray(records.TXT) ? records.TXT : [records.TXT];
      for (const txt of txtEntries) {
        const res = await createRecord(name, "TXT", txt);
        createdIds.push(res.result.id);
      }
    }

    if (records.NS) {
      for (const ns of records.NS) {
        const res = await createRecord(name, "NS", ns);
        createdIds.push(res.result.id);
      }
    }

    if (records.CAA) {
      for (const entry of records.CAA) {
        const res = await createRecordWithData(name, "CAA", {
          flags: entry.flags || 0,
          tag: entry.tag,
          value: entry.value,
        });
        createdIds.push(res.result.id);
      }
    }

    if (records.DS) {
      for (const entry of records.DS) {
        const res = await createRecordWithData(name, "DS", {
          key_tag: entry.key_tag,
          algorithm: entry.algorithm,
          digest_type: entry.digest_type,
          digest: entry.digest,
        });
        createdIds.push(res.result.id);
      }
    }

    if (records.SRV) {
      for (const entry of records.SRV) {
        const res = await createRecordWithData(name, "SRV", {
          priority: entry.priority,
          weight: entry.weight,
          port: entry.port,
          target: entry.target,
        });
        createdIds.push(res.result.id);
      }
    }

    if (records.TLSA) {
      for (const entry of records.TLSA) {
        const res = await createRecordWithData(name, "TLSA", {
          usage: entry.usage,
          selector: entry.selector,
          matching_type: entry.matching_type,
          certificate: entry.certificate,
        });
        createdIds.push(res.result.id);
      }
    }

    if (records.URL) {
      const res = await createRecord(name, "A", "192.0.2.1", true);
      createdIds.push(res.result.id);
      console.log(`  ⚠ URL redirect requires Cloudflare Page Rule to be configured separately`);
    }
  } catch (err) {
    // Creation failed — rollback newly created records, leaving old ones intact
    console.error(`  ✗ Creation failed for ${name}.${BASE_DOMAIN}: ${err.message}`);
    if (createdIds.length > 0) {
      console.log(`  Rolling back ${createdIds.length} newly created record(s)...`);
      for (const id of createdIds) {
        try {
          await deleteRecord(id);
        } catch (rollbackErr) {
          console.error(`  ✗ Rollback failed for record ${id}: ${rollbackErr.message}`);
        }
      }
    }
    console.log(`  Old records left intact for ${name}.${BASE_DOMAIN}`);
    throw err;
  }

  // Phase 2: All creations succeeded — safe to remove old records now
  for (const record of existing) {
    console.log(`  Deleting old ${record.type} record (${record.id})`);
    try {
      await deleteRecord(record.id);
    } catch (err) {
      console.error(`  Warning: Failed to delete old record ${record.id}: ${err.message}`);
    }
  }

  console.log(`  ✓ Deployed successfully`);
}

async function main() {
  // Get all domain files
  const files = fs
    .readdirSync(DOMAINS_DIR)
    .filter((f) => f.endsWith(".json") && f !== "schema.json");

  console.log(`Found ${files.length} domain(s) to deploy.`);

  const existingSubdomains = new Set(files.map((f) => path.basename(f, ".json")));

  for (const file of files) {
    try {
      await deployDomain(file);
    } catch (e) {
      console.error(`  ✗ Failed to deploy ${file}: ${e.message}`);
      process.exit(1);
    }
  }

  // Clean up DNS records for deleted domains
  console.log("\nChecking for deleted domains...");
  try {
    let page = 1;
    let allRecords = [];
    while (true) {
      const data = await cfRequest(
        "GET",
        `/zones/${CF_ZONE_ID}/dns_records?per_page=100&page=${page}`
      );
      allRecords = allRecords.concat(data.result || []);
      if (data.result_info && page >= data.result_info.total_pages) break;
      page++;
    }

    const deletedRecords = allRecords.filter((r) => {
      const fqdn = r.name;
      if (!fqdn.endsWith(`.${BASE_DOMAIN}`)) return false;
      const subdomain = fqdn.replace(`.${BASE_DOMAIN}`, "");
      // Skip root domain records and multi-level subdomains
      if (!subdomain || subdomain.includes(".")) return false;
      const lower = subdomain.toLowerCase();
      // Always skip underscore-prefixed subdomains (_dmarc, _acme-challenge, _domainkey, etc.)
      if (lower.startsWith("_")) return false;
      // Never delete reserved or explicitly protected infrastructure subdomains
      if (RESERVED_SUBDOMAINS.has(lower)) return false;
      if (PROTECTED_SUBDOMAINS.has(lower)) return false;
      return !existingSubdomains.has(subdomain);
    });

    if (deletedRecords.length > 0) {
      console.log(`Found ${deletedRecords.length} orphaned DNS record(s) to remove.`);
      for (const record of deletedRecords) {
        console.log(`  Deleting orphaned ${record.type} record: ${record.name} (${record.id})`);
        await deleteRecord(record.id);
      }
    } else {
      console.log("No orphaned DNS records found.");
    }
  } catch (e) {
    console.error(`  Warning: Failed to clean up deleted domains: ${e.message}`);
  }

  console.log("\nDeployment complete.");
}

main();
