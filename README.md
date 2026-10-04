# LinkForge

A URL shortener built with React, Vite, and Express. Create short links with generated codes or custom aliases, copy and open them, track redirect clicks, and delete links from the dashboard.

## Quick start

Install Node.js **22.12 or later** and npm, then run these commands from the repository root:

```bash
npm install
cp server/.env.example server/.env
npm run dev
```

Open **http://localhost:5173**. The API runs at **http://localhost:3000**; Vite proxies `/api` requests to it. Short links point to the API, which redirects visitors to their destinations.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the API and React development server together. |
| `npm test` | Run backend HTTP tests and skip optional integration tests. |
| `npm run test:integration` | Test a separately running API. |
| `npm run build` | Build the frontend into `web/dist/`. |
| `npm start` | Start Express, serving the built frontend when available. |

To run the production application locally, run `npm run build` followed by `npm start`, then open **http://localhost:3000**.

## Configuration

Set backend options in `server/.env`:

```dotenv
PORT=3000
BASE_URL=http://localhost:3000
```

`BASE_URL` is the externally reachable origin used in generated short links. For deployment, set it to your public HTTPS URL. Keep `.env` files out of version control. If you change the development API port, set `API_PROXY_TARGET` to the matching API origin when running Vite.

## API

Successful JSON responses use `{ "data": ... }`; errors use `{ "error": "message" }`.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/health` | Return API status. |
| GET | `/api/links` | List links and click counts. |
| POST | `/api/links` | Create a link with `url` and optional `customAlias`; return 201. |
| DELETE | `/api/links/:code` | Delete a link; return 404 if missing. |
| GET | `/:code` | Redirect with 302 and increment clicks. |

```bash
curl -X POST http://localhost:3000/api/links \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/article","customAlias":"my-article"}'
```

Links contain `code`, `url`, `shortUrl`, `createdAt`, and `clicks`. Destinations must be absolute HTTP or HTTPS URLs without embedded credentials. Custom aliases contain 3–32 letters, digits, underscores, or hyphens. Existing or reserved aliases return 409.

## Project structure

```text
server/src/        Express API, startup, and in-memory link store
server/test/       Isolated backend HTTP tests
web/src/           React dashboard and styles
tests/integration/ Optional tests against a running API
docs/              Test instructions and manual checks
```

See [AGENTS.md](AGENTS.md) for contributor conventions and [docs/testing.md](docs/testing.md) for validation instructions.

## Current scope

Links live in memory and reset when the server restarts. The dashboard and API are public and unauthenticated: everyone can view or delete all links. This is a local prototype; persistence, user accounts, authorization, and abuse protection are future work before operating a shared public service.
