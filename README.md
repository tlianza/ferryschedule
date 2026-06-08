# Ferry Schedule

Fresh static site implementation for the Larkspur <-> San Francisco ferry schedule.

## Stack

- Static assets in `static/` (HTML/CSS/JS)
- Lightweight Worker in `worker/index.js`
- Cloudflare Workers Assets via `wrangler.toml`

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Run local dev server:

```bash
npm run dev
```

Wrangler serves both the Worker and static assets.

## Deploy

```bash
npm run deploy
```

You will need to be authenticated with Cloudflare in your terminal (`npx wrangler login`).

## Analytics

Google Universal Analytics (`UA-*`) is sunset, so use a GA4 measurement ID (`G-*`).

1. Open `static/index.html`.
2. Set the tag in the head section:

```html
<meta name="google-analytics-id" content="G-XXXXXXXXXX" />
```

If the value is empty, analytics is disabled.

## Data Refresh

1. Copy `.env.example` to `.env` and set your key:

```bash
cp .env.example .env
```

Then edit `.env` and set `API_511_KEY=...`.

2. Refresh timetable data:

```bash
npm run refresh:data
```

This writes the latest feed to `static/data/timetable.json` using:

```bash
https://api.511.org/transit/timetable?api_key=KEY_HERE&format=json&operator_id=GF&line_id=LSSF
```

The output is canonicalized (object keys sorted, pretty-printed; array order
preserved) so the file changes only when the underlying data changes, keeping
diffs small and review-friendly. The fetch retries with backoff because the 511
API frequently drops connections.

### Release from the CLI

```bash
npm run release
```

This runs `refresh:data`, and if `static/data/timetable.json` changed, commits
just that file and pushes. The push triggers the existing deploy hook, so the
live site updates — there's no separate `wrangler deploy` step. If the data is
unchanged, it commits nothing and exits.

### Scheduled refresh (GitHub Actions)

`.github/workflows/refresh-data.yml` runs the refresh automatically:

- **When:** daily at 13:00 UTC (~6am Pacific), plus a manual "Run workflow"
  button on the Actions tab (`workflow_dispatch`).
- **What:** fetches the feed and, only if `timetable.json` changed, commits and
  pushes the update as `github-actions[bot]`. That push flows into the same
  deploy hook, so the live site refreshes hands-off. The workflow never runs
  `wrangler` itself.
- **Requirement:** the repo must have an `API_511_KEY` Actions secret
  (Settings → Secrets and variables → Actions). Set it via the web UI or with
  the CLI:

  ```bash
  gh secret set API_511_KEY -R <owner>/<repo>
  ```

To trigger a run on demand: `gh workflow run refresh-data.yml`.
