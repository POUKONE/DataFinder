# DataFinder

[![GitHub](https://img.shields.io/badge/GitHub-POUKONE%2FDataFinder-181717?logo=github)](https://github.com/POUKONE/DataFinder)
[![CI](https://github.com/POUKONE/DataFinder/actions/workflows/ci.yml/badge.svg)](https://github.com/POUKONE/DataFinder/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Self-hosted Next.js application to search, filter, compare, and save data sources.

Lire en [français](README.md).

## Requirements

- Node.js 22 or Docker
- npm 10 or later

## Local development

```bash
npm ci
npm run dev
```

Then open `http://localhost:3000`.

## Running in production with Node.js

```bash
npm ci
npm run build
DATAFINDER_PUBLIC_URL=https://data.example.com DATAFINDER_API_KEY=a-long-random-key npm start
```

## Hosting with Docker

Create a `.env` file (see `.env.example`) containing at least `DATAFINDER_API_KEY`, then:

```bash
docker compose up -d --build
```

The application listens on port `3000`. Update `DATAFINDER_PUBLIC_URL` in `compose.yaml` to match your public domain.

## Hosting on Vercel

Since data is now persisted on Supabase rather than local disk, the app can be deployed as-is on Vercel:

1. Import the GitHub repository into Vercel
2. Set these environment variables in the Vercel project: `DATAFINDER_PUBLIC_URL`, `DATAFINDER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (and `BRAVE_SEARCH_API_KEY` if web search is used)
3. Deploy — Vercel auto-detects Next.js, no extra configuration is needed

`GET /api/web-search` rate limiting remains in-memory per instance: on Vercel, several serverless instances can run in parallel, so this limit is no longer strictly enforced at a global scale.

## API authentication

Read endpoints (`GET /api/datasets`, `GET /api/datasets/:id`) stay public. Write endpoints (`POST /api/datasets`, `PUT /api/datasets/:id`, `DELETE /api/datasets/:id`) require an API key set via the `DATAFINDER_API_KEY` environment variable, sent in the `Authorization` header:

```bash
curl -X DELETE https://data.example.com/api/datasets/my-dataset \
  -H "Authorization: Bearer $DATAFINDER_API_KEY"
```

Without `DATAFINDER_API_KEY` configured server-side, these routes return `503`. A missing or invalid key returns `401`.

## Web search

In addition to the DataFinder catalog, the search bar also queries the web through the [Brave Search](https://brave.com/search/api/) API. This feature is optional: without a key configured, only catalog results are shown.

1. Create an account at [api-dashboard.search.brave.com/register](https://api-dashboard.search.brave.com/register) (a credit card is required for anti-fraud verification, not charged within the free credit), then pick the "Search" plan ($5 of free monthly credit, roughly 1,000 requests).
2. Add the key to `.env`:

```
BRAVE_SEARCH_API_KEY=your_key
```

`GET /api/web-search?q=...` is public and read-only (like `GET /api/datasets`) and doesn't require `DATAFINDER_API_KEY`. Without `BRAVE_SEARCH_API_KEY`, it returns `503`.

Since this route triggers a paid call to the Brave API, it's protected by an in-memory rate limiter (per IP, reset on server restart): 10 requests per minute by default, adjustable via `WEB_SEARCH_RATE_LIMIT` (request count) and `WEB_SEARCH_RATE_WINDOW_MS` (window duration in milliseconds). Beyond that, the route returns `429` with a `Retry-After` header.

## Database

Datasets are persisted in [Supabase](https://supabase.com) (managed Postgres), via the `@supabase/supabase-js` client. Two variables are required:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SECRET_KEY=your_service_role_key
```

Use the **service_role** key (`Project Settings > Database > Connect > Server`), never the public/anon key: it grants full access to the database and must only ever be known to the server. This backing store keeps the catalog durable enough to deploy on serverless platforms with an ephemeral filesystem (Vercel, etc.), in addition to classic Docker/VPS hosting.

The schema (`datasets` table, `meta` table for first-run seeding, `get_catalog_stats` function) must be created once in your Supabase project's SQL editor — see the comments at the top of `lib/db.ts` for the exact statements.

With Docker, `SUPABASE_URL` and `SUPABASE_SECRET_KEY` must be provided both as build arguments (`compose.yaml` passes them automatically) and as runtime environment variables, since `next build` already queries the database while generating pages.

## Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name data.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then enable HTTPS with your usual certificate manager, e.g. Certbot or Caddy.

## Checks

```bash
npm test
npm run lint
```

`npm test` runs the build then the `node:test` suite (via `tsx`, with `--test-concurrency=1`): the rendering smoke test plus unit tests for the CRUD, pagination, authentication, rate limiting, and web search logic. Dataset-related tests wipe the whole table on every test (`resetDatasets`): they must **never run against the `public` schema** (the production one), or the entire catalog would be lost.

For this reason, tests target a separate Postgres schema, `test`, in the same Supabase project (avoids using up a second free project). Create it once via the Supabase SQL editor — see the comments at the top of `lib/db.ts` for the exact schema (`datasets`/`meta` tables + `get_catalog_stats` function, prefixed with `test.`), and remember to add `test` to "Exposed schemas" under `Project Settings > Data API`. Then create a `.env.test` file (not committed):

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SECRET_KEY=your_service_role_key
SUPABASE_SCHEMA=test
```

`npm test` loads `.env.test` (not `.env`) for the test phase — only the initial build phase still touches the `public` schema, harmlessly (connectivity check + idempotent seeding). Test execution is forced sequential (`--test-concurrency=1`) so no test file tramples another's data while wiping the table.

These checks also run automatically on GitHub Actions on every push and pull request (see `.github/workflows/ci.yml`): make sure to set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (the production ones — the workflow forces `SUPABASE_SCHEMA=test`) in the repository's GitHub secrets.

The `/api/health` route verifies the Supabase database actually responds and returns `200` (`status: "ok"`) or `503` (`status: "error"`) accordingly; it can be used by Docker, your orchestrator, or your hosting provider.

## License

[MIT](LICENSE) © 2026 POUKONE
