import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Release flow: refresh the 511 feed, commit the data file if it changed,
// and push. A push triggers the existing deploy hook, so we never call
// wrangler here.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILE = "static/data/timetable.json";

function must(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

// 1. Pull the latest feed into static/data/timetable.json.
must("node", ["scripts/refresh-data.mjs"]);

// 2. Stage just the data file and bail out cleanly if nothing changed.
must("git", ["add", "--", DATA_FILE]);
const unchanged =
  spawnSync("git", ["diff", "--cached", "--quiet", "--", DATA_FILE], {
    cwd: ROOT,
  }).status === 0;

if (unchanged) {
  console.log("Timetable unchanged; nothing to commit or push.");
  process.exit(0);
}

// 3. Commit only the data file, then push (the deploy hook takes it from here).
const stamp = new Date().toISOString().slice(0, 10);
must("git", ["commit", "-m", `Refresh timetable data (${stamp})`, "--", DATA_FILE]);
must("git", ["push"]);

console.log("Pushed refreshed timetable. Deploy hook will publish the update.");
