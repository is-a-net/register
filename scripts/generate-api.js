const fs = require("fs");
const path = require("path");

const DOMAINS_DIR = path.join(__dirname, "..", "domains");
const API_DIR = path.join(__dirname, "..", "api");
const BASE_DOMAIN = "is-a.net";

function main() {
  // Create api/ directory
  if (!fs.existsSync(API_DIR)) {
    fs.mkdirSync(API_DIR, { recursive: true });
  }

  // Read all domain files (exclude schema.json)
  const files = fs.readdirSync(DOMAINS_DIR)
    .filter(f => f.endsWith(".json") && f !== "schema.json")
    .sort();

  const domains = [];
  const domainNames = [];

  for (const file of files) {
    const filePath = path.join(DOMAINS_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const subdomain = path.basename(file, ".json");

      domains.push({
        domain: `${subdomain}.${BASE_DOMAIN}`,
        subdomain,
        owner: {
          username: data.owner?.username || "unknown",
        },
        records: data.records || {},
        proxied: data.proxied === true,
      });

      domainNames.push(subdomain);
    } catch (e) {
      console.warn(`Warning: Failed to parse ${file}: ${e.message}`);
    }
  }

  const now = new Date().toISOString();

  // Full API
  const fullApi = {
    generated_at: now,
    total_domains: domains.length,
    domains,
  };

  // Lightweight domain list
  const domainList = {
    generated_at: now,
    total_domains: domainNames.length,
    domains: domainNames,
  };

  fs.writeFileSync(
    path.join(API_DIR, "v1.json"),
    JSON.stringify(fullApi, null, 2)
  );

  fs.writeFileSync(
    path.join(API_DIR, "domains.json"),
    JSON.stringify(domainList, null, 2)
  );

  console.log(`Generated API files: ${domains.length} domains`);
  console.log(`  api/v1.json (${JSON.stringify(fullApi).length} bytes)`);
  console.log(`  api/domains.json (${JSON.stringify(domainList).length} bytes)`);
}

main();
