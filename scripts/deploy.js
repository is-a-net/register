const fs = require("fs");
const path = require("path");

const DOMAINS_DIR = path.join(__dirname, "..", "domains");
const CF_API_BASE = "https://api.cloudflare.com/client/v4";

// Environment variables (set via GitHub Secrets)
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ZONE_ID = process.env.CF_ZONE_ID;
const BASE_DOMAIN = "is-a.net";

// Subdomains managed outside domain JSON files (infrastructure, manual Cloudflare records)
// These are NEVER deleted by orphaned record cleanup
const PROTECTED_SUBDOMAINS = new Set([
  "this",    // Landing page (CNAME → is-a-net.github.io)
  "www",     // Potential www redirect
  "api",     // API endpoint
  "mail",    // Mail infrastructure
  "smtp",    // Mail infrastructure
  "imap",    // Mail infrastructure
  "pop",     // Mail infrastructure
  "_dmarc",  // DMARC record
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

  // Get existing records for this subdomain
  const existing = await listExistingRecords(name);

  // Delete existing records to avoid conflicts
  for (const record of existing) {
    console.log(`  Deleting old ${record.type} record (${record.id})`);
    await deleteRecord(record.id);
  }

  // Create new records
  if (records.A) {
    for (const ip of records.A) {
      await createRecord(name, "A", ip, proxied);
    }
  }

  if (records.AAAA) {
    for (const ip of records.AAAA) {
      await createRecord(name, "AAAA", ip, proxied);
    }
  }

  if (records.CNAME) {
    await createRecord(name, "CNAME", records.CNAME, proxied);
  }

  if (records.MX) {
    for (const entry of records.MX) {
      const target = typeof entry === "string" ? entry : entry.target;
      const priority = typeof entry === "object" ? (entry.priority || 10) : 10;
      await createRecord(name, "MX", target, false, priority);
    }
  }

  if (records.TXT) {
    const txtEntries = Array.isArray(records.TXT) ? records.TXT : [records.TXT];
    for (const txt of txtEntries) {
      await createRecord(name, "TXT", txt);
    }
  }

  if (records.NS) {
    for (const ns of records.NS) {
      await createRecord(name, "NS", ns);
    }
  }

  if (records.CAA) {
    for (const entry of records.CAA) {
      await createRecordWithData(name, "CAA", {
        flags: entry.flags || 0,
        tag: entry.tag,
        value: entry.value,
      });
    }
  }

  if (records.DS) {
    for (const entry of records.DS) {
      await createRecordWithData(name, "DS", {
        key_tag: entry.key_tag,
        algorithm: entry.algorithm,
        digest_type: entry.digest_type,
        digest: entry.digest,
      });
    }
  }

  if (records.SRV) {
    for (const entry of records.SRV) {
      await createRecordWithData(name, "SRV", {
        priority: entry.priority,
        weight: entry.weight,
        port: entry.port,
        target: entry.target,
      });
    }
  }

  if (records.TLSA) {
    for (const entry of records.TLSA) {
      await createRecordWithData(name, "TLSA", {
        usage: entry.usage,
        selector: entry.selector,
        matching_type: entry.matching_type,
        certificate: entry.certificate,
      });
    }
  }

  if (records.URL) {
    await createRecord(name, "A", "192.0.2.1", true);
    console.log(`  ⚠ URL redirect requires Cloudflare Page Rule to be configured separately`);
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
      // Never delete protected infrastructure subdomains
      if (PROTECTED_SUBDOMAINS.has(subdomain.toLowerCase())) return false;
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
