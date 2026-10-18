# Traffic preparation: 10–25 rooms

Target: up to 25 concurrent rooms with four members each (100 connected users). Changes and tests are local; no deployed host has been tested or configured.

## Implemented

- SQLite schema version 3 maintains capture-byte counters with transactional triggers. Quota checks no longer scan every stored image on every upload. Existing records are counted once during migration; updates, idempotent upserts, deletion, and room cascades maintain totals.
- Routine socket snapshots skip fetching capture image bodies. Capture completion checks use metadata. Capture retries read only the matching image length instead of fetching all photos. Shared-editor updates send one canonical snapshot rather than a duplicate editor-image event.
- Retention cleanup runs at most once per minute on request paths. Expired membership reclamation remains immediate.
- HTTP parsing is guarded by a configurable concurrent-request cap (32 default); overload responds with 503 and Retry-After. HTTP rate limit is 1,200 requests/IP/minute, room creation 30/IP/minute, and socket connection attempts 300/address/minute to accommodate shared event Wi-Fi.
- Capture uploads allow 60 seconds per attempt and retry temporary network failures and HTTP 429/502/503/504 twice, respecting Retry-After and adding jitter. The original round/member/frame key is retained. Validation, permission, and stale-round failures are not retried. Create-room requests are not retried automatically.
- Nginx example enables gzip for text/JSON, immutable caching for hashed Vite assets, HTML revalidation, and unbuffered socket traffic. These settings require deployment and nginx configuration validation; they were not run locally.

## Local measurements

Reproduce from `photodate-server`:

```powershell
npm run test:load
```

The harness exclusively creates its own temporary SQLite database, generated valid 320×180 noisy PNG fixtures, and localhost server on an ephemeral port. It never connects to production. Tests use 25 rooms, 100 real WebSocket clients, two captures/person, all-member downloads, and one shared editor publish/room. Capture deadlines are advanced in the test database so this measures traffic rather than countdown duration. Requests have a 30-second harness timeout; socket acknowledgements have 10 seconds.

| Metric | 16 concurrent HTTP workers | 64-worker burst |
| --- | ---: | ---: |
| Completed rooms / users | 25 / 100 | 25 / 100 |
| HTTP requests | 400 | 400 |
| Upload phase | 1.532 s | 1.799 s |
| HTTP median | 120 ms | 479 ms |
| HTTP p95 | 289 ms | 1,087 ms |
| HTTP maximum | 315 ms | 1,233 ms |
| Event-loop p95 | 164 ms | 411 ms |
| Upload request bodies | 44.05 MiB | 44.05 MiB |
| HTTP response bodies | 176.46 MiB | 176.46 MiB |
| Socket event payloads | 49.20 MiB | 49.20 MiB |
| Busy retries | 0 | 0 |

Both runs completed with eight unique captures per room. The initial upload-only benchmark took 7.106 seconds before the quota-counter change; afterward its upload phase took 1.495 seconds. This comparison uses the earlier smaller workload, not the expanded test above.

Numbers are application payload sizes before transport compression and exclude TLS/HTTP/WebSocket framing and initial frontend asset loads. CPU, server, load generator, and clients run in the same Node process; reported memory (about 162–181 MiB RSS) is not a production server sizing result. These are short local bursts, not an endurance test or a deployment capacity guarantee. WAN latency, packet loss, proxy behavior, real camera image sizes, larger capture counts, and simultaneous editing can change results substantially.

Configure an alternative run:

```powershell
$env:LOAD_ROOMS = '10'       # 1–25
$env:LOAD_CONCURRENCY = '16' # 1–64
npm run test:load
```

## Bandwidth and storage budget

Photo traffic dominates. For R rooms, P participants, F shots, and B bytes per encoded data URL:

- Capture uploads: R × P × F × B.
- All-member capture downloads: approximately uploads × P.
- Shared editor snapshots add photo data again when a host publishes edits. Static caching does not reduce these authenticated/private responses.

For example, 25 rooms × four people × four shots × 200 KiB per encoded image is about 78 MiB uploaded and 313 MiB downloaded, before shared-editor traffic. If all those downloads must finish in ten seconds, their payload alone needs roughly 262 Mbps of server outbound throughput. Actual JPEG sizes vary; measure the deployed app rather than assuming this example.

Current caps remain 64 MiB of capture data per room and 512 MiB across stored captures. These are logical capture-data caps, not total SQLite disk usage: editor documents, WAL files, indexes, and backups add space. At the example size, the global capture cap holds about 164 such completed rooms before retention removes them. Turnover matters as much as simultaneous users. Default retention is 24 hours; choose an appropriate retention policy before an event and monitor storage. Do not silently delete users' active photos to make room.

## Deployment gate

- Back up the existing database before the first startup that applies schema v3.
- Use one Node server process with persistent SQLite storage. Presence and room broadcasts are process-local; multiple workers or replicas require a shared Socket.IO adapter/presence design before horizontal scaling.
- With the supplied same-machine reverse proxy, set `TRUST_PROXY=loopback`. Restrict direct access to the Node port. Use an actual trusted-proxy setting for any different topology; never trust arbitrary forwarded IP headers.
- Apply and validate the nginx example, then rerun representative traffic against staging with real camera JPEG sizes and four/twelve-shot sessions. The included harness intentionally has no external target option.
- Measure p95 response latency, event-loop delay, memory, SQLite/WAL disk usage, 429/503 responses, upload failures, and outbound bandwidth on the real host. Large bursts already increase local p95 substantially.
- If outbound photo traffic or editing becomes the limit, move image bytes into private object storage with authorized URLs and send editor deltas rather than repeatedly embedding base64 photos. This architecture change is not implemented here.

Validation: 17 server tests and nine client tests pass, including overload admission/recovery, migration byte counters, upload retry bounds, and stale/auth failure behavior. Client build and lint pass. No existing user database was opened or changed by the benchmark.
