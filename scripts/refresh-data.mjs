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

// Recursively sort object keys for stable output. Arrays keep their order,
// since schedule sequence is meaningful.
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
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

  const response = await fetch(url);
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
