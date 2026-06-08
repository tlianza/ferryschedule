import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ENV_FILE = ".env";
const OUTPUT_FILE = path.resolve("static/data/timetable.json");
const API_BASE_URL = "https://api.511.org/transit/timetable";

function parseEnv(content) {
  const env = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

async function loadDotEnv(filePath) {
  try {
    const envContent = await readFile(filePath, "utf8");
    return parseEnv(envContent);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

// The 511 API regularly drops or stalls connections, especially from
// datacenter IPs (e.g. GitHub runners). Retry a few times with backoff and a
// per-attempt timeout, and surface the underlying cause when fetch() throws.
async function fetchWithRetry(url, { attempts = 4, timeoutMs = 20000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      lastError = error;
      const cause = error.cause ? ` (cause: ${error.cause.code || error.cause.message})` : "";
      console.error(`Attempt ${attempt}/${attempts} failed: ${error.message}${cause}`);
      if (attempt < attempts) {
        const delayMs = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

// Keys to drop: 511 regenerates these internal record IDs/refs on most
// fetches even when the schedule is unchanged, which would churn the file (and
// trigger deploys) for no real change. The app reads schedules positionally
// from Call arrays and never uses these, so dropping them is safe.
const VOLATILE_KEYS = new Set(["id", "ref"]);

// Recursively sort object keys for stable output and drop volatile keys.
// Arrays keep their order, since schedule sequence is meaningful.
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => !VOLATILE_KEYS.has(key))
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

async function main() {
  const envFromFile = await loadDotEnv(ENV_FILE);
  const apiKey = process.env.API_511_KEY || envFromFile.API_511_KEY;

  if (!apiKey) {
    console.error("Missing API key. Set API_511_KEY in .env or shell env.");
    process.exit(1);
  }

  const url = new URL(API_BASE_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("operator_id", "GF");
  url.searchParams.set("line_id", "LSSF");

  const response = await fetchWithRetry(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`511 request failed (${response.status}): ${body.slice(0, 400)}`);
  }

  const payload = await response.text();

  // Canonicalize so the on-disk file changes only when the data actually
  // changes. The 511 API can vary key ordering/whitespace between requests;
  // sorting object keys (array order is preserved) and pretty-printing keeps
  // byte-identical schedules byte-identical, so we don't churn commits daily.
  const normalized = JSON.stringify(canonicalize(JSON.parse(payload)), null, 2) + "\n";

  const outputDir = path.dirname(OUTPUT_FILE);
  await mkdir(outputDir, { recursive: true });
  await writeFile(OUTPUT_FILE, normalized, "utf8");

  console.log(`Wrote latest schedule to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
