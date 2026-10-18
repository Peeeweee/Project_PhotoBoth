# Deploy the whole app as one service

The root Dockerfile builds React and Express, runs repository checks, and packages both with SQLite support. One origin serves the frontend, `/api/rooms`, and `/socket.io`; `/rooms` remains compatible with the existing separate-host setup. Set `CLIENT_DIST` to enable static hosting outside Docker. Static assets are cached; client routes fall back to HTML while unknown API and asset requests remain 404.

## Railway setup

1. Connect this GitHub repository as a new service. Keep its root directory at the repository root so Docker can access both packages and `shared`.
2. Railway can build the root Dockerfile. Attach a persistent volume at `/data` before allowing real sessions.
3. Generate the public HTTPS domain. Set `CLIENT_ORIGINS` to that full origin, such as `https://your-service.up.railway.app`, without a trailing slash. Leave `VITE_SERVER_URL` unset: the client uses same-origin API and socket URLs.
4. Keep `DB_PATH=/data/photodate.db`, `CLIENT_DIST=/app/client`, `HOST=0.0.0.0`, and `NODE_ENV=production` (image defaults). Use the platform-provided `PORT` when present. Set `RAILWAY_RUN_UID=0` for Railway's root-owned volume, as required by its volume permissions documentation for non-root images. Do not set broad proxy trust; the shared-IP limits work without it.
5. Use `/health` as the deployment health-check path. Run exactly one replica. Disable sleeping/serverless mode for live events.
6. Set a spending limit/alert, enable volume backups, and check available storage. The app's logical capture quota remains 512 MiB; editor data and SQLite WAL files also need disk space.

Official references: [Dockerfiles](https://docs.railway.com/builds/dockerfiles), [volumes and permissions](https://docs.railway.com/volumes), [pricing](https://railway.com/pricing).

The app is not deployed merely by pushing GitHub code. A hosting account, service, public domain, volume, and environment settings must be created before there is a live URL. No paid hosting resources are created by the repository files.

## Local container smoke test

Start Docker Desktop with Linux containers, then from the repository root:

```powershell
docker build -t photodate .
docker volume create photodate-data
docker run --rm --name photodate -p 3001:3001 -v photodate-data:/data -e CLIENT_ORIGINS=http://localhost:3001 photodate
```

Open `http://localhost:3001`. Keep the volume when recreating the container. A local container build has not been verified here because the Docker daemon was not running; application builds/tests were verified separately.

## Launch checks

- Open `/health`, then load `/`, `/design`, and `/capture` over HTTPS. Verify hashed assets load and unknown `/api/...` routes return JSON 404.
- Create a room, join from a second device, enable cameras, approve on each device, and complete capture and export. Check both WebSocket and polling fallback on the real host.
- Restart the service and verify the database survives, room credentials resume within the grace period, and the interrupted capture resets to readiness.
- Repeat representative load testing on staging; local results in `TRAFFIC_PLAN.md` are not production capacity guarantees.
- Existing local databases/photos are never bundled into the image. If old data is needed, stop/backup the old service and transfer a protected consistent backup to the new volume before startup. Back up before schema v3 migration.
