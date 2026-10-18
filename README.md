# PhotoDate photobooth

A shared photobooth for up to four participants using React, Vite, Express, Socket.IO and SQLite. Each device captures its own camera at server-scheduled deadlines. The editor combines real participant photos into shared group frames; live remote camera feeds are not streamed.

## Local setup

Use Node.js 24 LTS and npm. In the server directory:

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

In another terminal, from the client directory:

```powershell
npm ci
npm run dev
```

Open http://localhost:5173. Vite forwards /api and /socket.io to the backend on port 3001. For a separate API origin set VITE_SERVER_URL before building/starting the client and include the frontend origin in server CLIENT_ORIGINS.

Create a room and open its invitation in another browser or separate tab. Each participant enables their own camera. The host selects layout/design, waits for all cameras, then starts. Upload retries retain their participant/round/frame identity. Review begins when all expected uploads finish. The host edits; guests view the shared result and can export their own copy.

Mobile camera testing needs HTTPS with a trusted certificate or tunnel; plain HTTP LAN addresses generally cannot use cameras. To expose the Vite server on your LAN, run `node node_modules/vite/bin/vite.js --host` from the client directory. Development servers are for local testing.

## Checks

From the server directory run `npm run typecheck` and `npm test`. From the client directory run `npm test`, `npm run lint` and `npm run build`. CI runs these checks on Node 24. Backend regression tests use temporary/in-memory data and real Socket.IO clients. `npm audit` requires access to the npm registry.

## Configuration

See each package's .env.example. Never commit private .env/database files.

| Server setting | Default | Purpose |
| --- | --- | --- |
| PORT | 3001 | HTTP/socket port |
| HOST | 0.0.0.0 | Use 127.0.0.1 behind a local reverse proxy |
| CLIENT_ORIGINS | http://localhost:5173 | Comma-separated browser origins |
| DB_PATH | server directory/photodate.db | Prefer an absolute persistent database path |
| RETENTION_HOURS | 24 | Room lifetime; expired room data is removed periodically |
| RECONNECT_GRACE_MS | 120000 | Reservation lifetime before first socket join, then guest removal / host room closure after disconnect |

Create/join issues a private session token held in sessionStorage. REST calls use a bearer credential; socket joins authenticate with the token. Participant IDs grant no authority. Clearing browser session data loses the membership; account recovery is not implemented. Reconnect restores authoritative room/editor state while membership is valid. Explicit leave acts immediately.

Room codes accept lowercase and surrounding whitespace. Retrying a join with the existing room credential resumes the same membership without consuming a slot; new guests can join only before capture starts. Reserved places expire after the configured grace period if a device never connects. Restart recovery preserves credentials, gives previously connected members a reconnect window, and resets an interrupted capture to camera readiness instead of replaying old deadlines. These leases were added in schema version 2; schema version 3 adds transactional capture-storage counters.

Photo bytes and editor data are stored in SQLite for the room lifetime. Browser persistence keeps compact preferences and identity, not the entire photo document. Image sizes/dimensions/types, frame counts, editor size, rooms, rates and storage are bounded. This targets small single-server deployments.

## Production

For the fastest single-service deployment, see [DEPLOYMENT.md](DEPLOYMENT.md) and the root Dockerfile. It serves the built frontend, API, and Socket.IO from one origin with a persistent database volume.

Run `npm run build` in each package. Start the backend with `npm start` and serve photodate-client/dist as static assets. The server build bundles its schema and can run without the source directory.

For same-origin hosting forward /api/* to the backend with /api removed, forward /socket.io/* with WebSocket upgrades, and provide an index.html fallback for client routes. See [deploy/nginx.conf.example](deploy/nginx.conf.example); replace the domain, certificates and static root. Configure the public origin, persistent database volume, production environment and process supervisor.

Run one backend process. Presence, reconnect timers, rate buckets and Socket.IO membership are process-local. Multiple replicas need coordinated state/rate limits and a Socket.IO adapter; sharing one SQLite file is not a scaling strategy. Repository checks do not deploy hosting or certificates.

## Backup and restore

Build first, then from the server directory with the same DB_PATH configuration:

```powershell
npm run backup -- C:/backups/photodate-backup.db
```

The command uses SQLite online backup, including committed WAL data. Backups contain private photos; protect and expire them too.

For restore, stop the server and preserve the current database together with its WAL/SHM sidecars in a separate recovery location. Copy the backup to the configured database path, start the server and verify integrity, migration and room access. Do not combine a restored database with sidecars from another database state. Regression tests exercise backup/restore with temporary files; they never restore over the existing database.

## Audit tracking

[AUDIT_REPORT.md](AUDIT_REPORT.md) preserves the original findings. [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) records fixes and verification limits.
