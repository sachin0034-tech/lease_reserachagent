# Deploy Backend to Azure App Service (sessions-safe)

This backend uses a **SQLite-backed session store** to avoid “Session not found” errors when running with multiple worker processes on **the same App Service instance**.

## Key points

- **Sessions are stored in SQLite** at `$HOME/legalgraph/sessions.db` (default). On App Service (Linux), `$HOME` maps to `/home` and is **persistent** when App Service storage is enabled.
- **If you scale out to 2+ instances**, each instance will have its **own** SQLite file. To keep a user on the same instance, you must rely on **ARR Affinity (sticky sessions)**.

## Required App Service settings

### 1) Enable App Service storage

For Linux App Service:

- **`WEBSITES_ENABLE_APP_SERVICE_STORAGE`**: `true`

This ensures `/home` is persisted. The session DB is stored under `$HOME`.

### 2) Enable ARR Affinity (sticky sessions)

- In the App Service UI, ensure **ARR Affinity** is **enabled**.
- If you scale out, this keeps a browser pinned to an instance.

### 3) Configure CORS correctly (required for cookies / affinity)

The backend enables credentials in CORS (`allow_credentials=True`), so the origin must be **explicit** (not `*`).

Set:

- **`CORS_ALLOW_ORIGINS`**: a comma-separated list of allowed frontend origins, e.g.
  - `https://your-site.netlify.app`
  - `http://localhost:3000` (dev)

Example:

- `CORS_ALLOW_ORIGINS=https://your-site.netlify.app,http://localhost:3000`

## Optional backend settings

- **`SESSION_TTL_SECONDS`**: session expiration in seconds (default 21600 = 6 hours). Example: `SESSION_TTL_SECONDS=14400` (4 hours).

## Frontend requirement (already implemented in this repo)

To let the browser send the App Service affinity cookie on cross-origin requests, frontend requests must include cookies:

- `fetch(..., { credentials: 'include' })`

This repo includes that for:

- `/api/analyze/start`
- `/api/analyze/stream`
- `/api/analyze/dashboard`
- `/api/analyze/chat`

## Scaling guidance (no Redis / external store)

- **Best reliability**: run **1 instance**.
- **If you must scale out**: keep ARR Affinity enabled. Users will stay pinned, but sessions are still **per-instance**; a user may lose the session if Azure moves them to a different instance (recycle/scale events).

