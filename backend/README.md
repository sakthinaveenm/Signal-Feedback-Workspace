# Signal API — NestJS + MongoDB Atlas

Separate Node.js backend for the Signal project feedback dashboard. It stores projects and feedback in MongoDB through NestJS/Mongoose. No Atlas account, cluster, credentials, or deployment has been created by this code.

## Run locally

Requires Node.js 22 or newer and an Atlas cluster (or local MongoDB for development).

```powershell
cd backend
npm ci
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Edit .env locally: replace MONGODB_URI and ADMIN_API_KEY.
npm run build
npm run db:indexes
npm start
```

For development with source watching, use `npm run start:dev`. Restart it after editing `.env`.

The API defaults to `http://localhost:3001/v1`. Configuration fails at startup if the MongoDB URI or admin key is missing/placeholder. Database credentials never belong in frontend code or Git. `.env.example` contains placeholders only.

## Configure MongoDB Atlas

1. Create or choose an Atlas cluster. Create a database user with `readWrite` access to the `signal` database (not your Atlas login).
2. In **Network Access**, allow the IP of your development machine, then the API host's outbound IP for deployment. Prefer specific IPs/private networking rather than allowing all addresses.
3. Choose **Connect → Drivers → Node.js** and copy the provided `mongodb+srv://` URI into the local `.env` file. Insert the database username and URL-encoded password. Use database `signal`, matching `MONGODB_DB_NAME`.
4. Generate a random admin key with the command above and set `ADMIN_API_KEY` locally. Do not send it in chat.
5. Run the commands above. `GET /v1/health/ready` should report `database: connected`.

Official references: [Atlas connection setup](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/) and [NestJS Mongoose integration](https://docs.nestjs.com/techniques/mongodb).

## API

All management endpoints require `Authorization: Bearer <ADMIN_API_KEY>`. This is a **single-owner service**, not a multi-user SaaS. The key gives access to all workspace projects. Keep it on the dashboard server only. If adding public user accounts later, implement per-user authentication and ownership checks before sharing management access.

| Method | Path (prefix `/v1`) | Behavior |
| --- | --- | --- |
| GET | `/health/live` | Public process liveness |
| GET | `/health/ready` | Public database connectivity check |
| GET / POST | `/projects` | List / create projects |
| GET / PATCH | `/projects/:id` | Read / rename, edit URL/platform, archive or unarchive |
| POST | `/projects/:id/rotate-key` | Return a new submission key, invalidating the previous one |
| GET / POST | `/feedback` | Paginated list / create feedback as owner |
| GET / PATCH / DELETE | `/feedback/:id` | Read / edit status, priority, notes / permanently delete |
| GET | `/feedback/export.csv` | Stream filtered CSV, with spreadsheet formula protection |
| GET | `/summary?projectId=<uuid>` | Total counts grouped by status and type; project is optional |
| POST | `/ingest/:projectId` | Submit using `X-Project-Key`; no admin token required |
| GET / POST | `/data` | Compatibility adapter for the existing Signal dashboard |

Project IDs and feedback IDs are UUIDs. Responses use `id`, `createdAt`, `updatedAt` and do not expose MongoDB `_id` or submission-key hashes.

### Create a project

```http
POST /v1/projects
Authorization: Bearer YOUR_ADMIN_KEY
Content-Type: application/json

{"name":"CaptionCopy","platform":"Web & Mobile","url":"https://example.com"}
```

Response: `{ "project": { "id": "...", ... }, "ingestionKey": "..." }`. Save the ingestion key in that project's server secret store; it is returned only on creation and rotation. The database stores its SHA-256 hash. Existing keys cannot be recovered. Normal project reads omit keys/hashes. Project platforms: `Web`, `Mobile`, `Web & Mobile`, `Other`. Archiving retains history and rejects subsequent feedback submissions; requests already in flight may complete.

### Submit from another app or website

```http
POST /v1/ingest/PROJECT_UUID
X-Project-Key: PROJECT_SUBMISSION_KEY
Content-Type: application/json

{"title":"Export crashes on Android","description":"Steps to reproduce…","type":"Bug","source":"Mobile","contact":"Optional reporter"}
```

Each project key can only submit to its project. It cannot list/read reports or choose internal status, priority, or notes. New submissions start with status `New` and priority `Medium`. Keys are secret: call this endpoint from your application's server, not directly from a public website/mobile binary. `integration/submit-feedback.mjs` provides a server-side helper. This API does not automatically scrape app stores, GitHub issues, email, or third-party review platforms.

Types: `Bug`, `Feature`, `Feedback`. Sources: `Web`, `Mobile`, `Email`, `Other`. Priorities: `Low`, `Medium`, `High`, `Critical`. Statuses: `New`, `Planned`, `In progress`, `Resolved`.

### Query and update

```http
GET /v1/feedback?projectId=PROJECT_UUID&status=New&type=Bug&search=export&page=1&limit=25
Authorization: Bearer YOUR_ADMIN_KEY
```

Response: `{ "items": [...], "total": 12, "page": 1, "limit": 25, "pages": 1 }`. `limit` is 1–100. Also supports `priority` and `source`. Search is case-insensitive literal matching of title, description and reporter, not raw regex. CSV accepts the same filters without page/limit and exports all matches. Dates are ISO timestamps in UTC.

```http
PATCH /v1/feedback/FEEDBACK_UUID
Authorization: Bearer YOUR_ADMIN_KEY
Content-Type: application/json

{"status":"In progress","priority":"High","notes":"Investigating Android 15."}
```

Unknown fields, invalid enums, malformed IDs, null fields and oversized text are rejected. A missing record returns 404. Deleting feedback permanently removes it; projects are archived rather than deleted to retain references/history.

## Connect the existing Signal frontend

The currently published frontend still uses its existing D1 storage. Nothing in this backend package changes or migrates live records.

After you deploy this API:

1. Set server-side frontend secrets `SIGNAL_API_URL=https://YOUR_API_HOST` (without `/v1`) and `SIGNAL_ADMIN_API_KEY=<same admin key>`.
2. Replace the frontend's `app/api/data/route.ts` with `integration/signal-route.ts.example` and redeploy the frontend. The proxy keeps the admin key out of browser code and maps Nest errors to the current UI's error shape.
3. Keep the dashboard owner-private. Before exposing it publicly, add authenticated server-side authorization to the proxy; CORS alone does not protect data.
4. Create projects in the new database. The old D1 data is separate. Existing D1 records are **not migrated automatically**. Back them up and plan a migration before switching if you have real records.

The `/v1/data` adapter returns `{ projects, reports }` and accepts current UI actions `project`, `report`, `update`, `delete`. It validates each action and is admin-only. For large datasets use the paginated REST API instead; this compatibility endpoint returns the entire workspace. The current frontend does not display/retain the one-time ingestion key when it creates a project; use REST creation or `/projects/:id/rotate-key` to obtain one for integration.

## Hosting

Deploy `backend/` to a Node.js/container host with outbound MongoDB TCP and DNS access. The current Cloudflare Workers Sites runtime cannot host this conventional NestJS/MongoDB service. A separate Node host is required; the Site can reach it through HTTPS.

For a generic Node host:

- Root directory: `backend`
- Install/build: `npm ci && npm run build`
- Start: `npm start`
- Secrets: `MONGODB_URI`, `MONGODB_DB_NAME`, `ADMIN_API_KEY`
- Set `NODE_ENV=production`. Let the host supply `PORT`, or use 3001.
- Set exact `CORS_ORIGINS` if browsers will call any allowed endpoint directly. The server-to-server Site proxy needs no CORS entry.
- Set `TRUST_PROXY_HOPS` to the known proxy hop count for accurate IP-based throttling. Do not blindly trust arbitrary forwarded IPs.
- Run `npm run db:indexes` once after the build with database access; production disables automatic index creation.
- Configure health probes at `/v1/health/live` and `/v1/health/ready`; terminate TLS at your host.

Or build the supplied Dockerfile from `backend/` and inject environment variables at runtime. Never bake `.env` into the image.

Built-in throttling is per process: 120 requests/minute/IP globally and 10 submissions/minute/IP on the ingestion handler. For multiple API replicas, add shared rate-limit storage or enforce equivalent limits at the gateway. Body parsing uses Nest/Express defaults. Indexes support project/date and status/date listing; literal text search scans matching records and may need Atlas Search at larger scale.

## Verification

```powershell
npm test
```

Tests run the actual Nest HTTP application and Mongoose models against an ephemeral local MongoDB process using `mongodb-memory-server`. The first test run downloads MongoDB, needs network access, and does not use or change Atlas. Coverage includes authorization, per-project key isolation/rotation, input validation, database writes/reads, filtering, summary, CSV protection, compatibility, archiving, deletion, and rate limiting. A passing local test does not verify your Atlas credentials, network access, DNS, or deployment.
