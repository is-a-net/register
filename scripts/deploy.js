const fs = require("fs");
const path = require("path");

const DOMAINS_DIR = path.join(__dirname, "..", "domains");
const CF_API_BASE = "https://api.cloudflare.com/client/v4";

// Environment variables (set via GitHub Secrets)
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ZONE_ID = process.env.CF_ZONE_ID;
const BASE_DOMAIN = "is-a.net";

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

async function createRecord(name, type, content, proxied = false) {
  console.log(`  Creating ${type} record: ${name}.${BASE_DOMAIN} -> ${content}`);
  return cfRequest("POST", `/zones/${CF_ZONE_ID}/dns_records`, {
    type,
    name: `${name}.${BASE_DOMAIN}`,
    content,
    proxied,
    ttl: 1, // Auto TTL
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
      await createRecord(name, "A", ip);
    }
  }

  if (records.AAAA) {
    for (const ip of records.AAAA) {
      await createRecord(name, "AAAA", ip);
    }
  }

  if (records.CNAME) {
    await createRecord(name, "CNAME", records.CNAME);
  }

  console.log(`  ✓ Deployed successfully`);
}

async function main() {
  // Get all domain files
  const files = fs
    .readdirSync(DOMAINS_DIR)
    .filter((f) => f.endsWith(".json") && f !== "schema.json");

  console.log(`Found ${files.length} domain(s) to deploy.`);

  // Also detect deleted domains (records in CF that no longer have a JSON file)
  const existingSubdomains = new Set(files.map((f) => path.basename(f, ".json")));

  for (const file of files) {
    try {
      await deployDomain(file);
    } catch (e) {
      console.error(`  ✗ Failed to deploy ${file}: ${e.message}`);
      process.exit(1);
    }
  }

  console.log("\nDeployment complete.");
}

main();
