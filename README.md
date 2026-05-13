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
